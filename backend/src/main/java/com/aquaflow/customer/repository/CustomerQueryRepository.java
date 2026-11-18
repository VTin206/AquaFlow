package com.aquaflow.customer.repository;

import com.aquaflow.customer.api.dto.CustomerPageResponse;
import com.aquaflow.customer.api.dto.CustomerSummary;
import com.aquaflow.shared.api.PageRequestParams;
import com.aquaflow.shared.api.SearchKeyword;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Danh sách khách có số liệu, lọc và phân trang bằng SQL. Số liệu tính cùng quy tắc với các API cũ:
 * số đơn bỏ đơn hủy (như trang Khách hàng), công nợ bỏ đơn chờ xác nhận (như /sales/customer-balances),
 * vỏ và cọc như /sales/bottle-balances.
 */
@Repository
public class CustomerQueryRepository {

    /** Lọc "lâu chưa mua": số ngày lịch theo giờ Việt Nam kể từ đơn gần nhất, hoặc chưa mua lần nào. */
    public sealed interface IdleFilter {
        record MoreThanDays(int days, LocalDate today) implements IdleFilter {
        }

        record Never() implements IdleFilter {
        }
    }

    private static final String SUMMARY = """
            WITH order_stats AS (
                SELECT customer_id, COUNT(*) AS order_count, MAX(created_at) AS last_order_at
                FROM orders WHERE customer_id IS NOT NULL AND status <> 'CANCELLED' GROUP BY customer_id
            ), last_address AS (
                SELECT DISTINCT ON (customer_id) customer_id, delivery_address
                FROM orders WHERE customer_id IS NOT NULL AND status <> 'CANCELLED'
                ORDER BY customer_id, created_at DESC, id DESC
            ), debt AS (
                SELECT customer_id, SUM(due) AS due
                FROM order_payment_balances WHERE customer_id IS NOT NULL AND status <> 'PENDING' GROUP BY customer_id
            ), bottles AS (
                SELECT customer_id, SUM(CASE WHEN movement IN ('GIVE', 'ADJUST_GIVE') THEN quantity ELSE -quantity END) AS held
                FROM bottle_transactions GROUP BY customer_id
            ), deposits AS (
                SELECT customer_id, SUM(CASE WHEN direction IN ('COLLECT', 'ADJUST_COLLECT') THEN amount ELSE -amount END) AS held
                FROM deposit_transactions GROUP BY customer_id
            ), summary AS (
                SELECT c.id, c.full_name, c.phone, c.created_at, c.customer_type, c.area, c.note,
                       COALESCE(s.order_count, 0) AS order_count, s.last_order_at,
                       a.delivery_address AS last_delivery_address,
                       COALESCE(d.due, 0) AS due, COALESCE(bt.held, 0) AS bottles_held, COALESCE(dp.held, 0) AS deposit_held
                FROM customers c
                LEFT JOIN order_stats s ON s.customer_id = c.id
                LEFT JOIN last_address a ON a.customer_id = c.id
                LEFT JOIN debt d ON d.customer_id = c.id
                LEFT JOIN bottles bt ON bt.customer_id = c.id
                LEFT JOIN deposits dp ON dp.customer_id = c.id
                WHERE c.active = TRUE
            )
            """;

    private static final RowMapper<CustomerSummary> ROW = (rs, n) -> {
        Timestamp createdAt = rs.getTimestamp("created_at");
        return new CustomerSummary(
                rs.getLong("id"), rs.getString("full_name"), rs.getString("phone"),
                createdAt == null ? null : createdAt.toInstant(),
                rs.getString("customer_type"), rs.getString("area"), rs.getString("note"),
                rs.getLong("order_count"), rs.getObject("last_order_at", OffsetDateTime.class),
                rs.getString("last_delivery_address"), rs.getBigDecimal("due"),
                rs.getLong("bottles_held"), rs.getBigDecimal("deposit_held"));
    };

    private final NamedParameterJdbcTemplate jdbc;

    public CustomerQueryRepository(JdbcTemplate jdbc) {
        this.jdbc = new NamedParameterJdbcTemplate(jdbc);
    }

    public record SummaryPage(List<CustomerSummary> items, long total) {
    }

    /** Cột sắp xếp của trang Khách hàng. Biểu thức SQL cố định ở đây, không lấy từ tham số người dùng. */
    public enum SortField {
        NAME("af_search_text(full_name)"),
        ORDERS("order_count"),
        LAST_ORDER("last_order_at"),
        DEBT("due"),
        BOTTLES("bottles_held");

        private final String expression;

        SortField(String expression) {
            this.expression = expression;
        }
    }

    /** Sắp xếp và chiều; mặc định theo tên A → Z. */
    public record Sort(SortField field, boolean descending) {
        public static final Sort DEFAULT = new Sort(SortField.NAME, false);

        /**
         * Như bảng ở frontend, "chưa mua lần nào" coi là nhỏ nhất: đứng đầu khi tăng dần, cuối khi giảm dần.
         * Trùng giá trị thì theo tên rồi id để lật trang ổn định.
         */
        String orderBy() {
            String direction = descending ? " DESC NULLS LAST" : " ASC NULLS FIRST";
            String tieBreak = field == SortField.NAME ? "" : ", af_search_text(full_name)";
            return " ORDER BY " + field.expression + direction + tieBreak + ", id";
        }
    }

    public SummaryPage search(SearchKeyword keyword, IdleFilter idle, Sort sort, PageRequestParams page) {
        MapSqlParameterSource params = new MapSqlParameterSource();
        String where = where(keyword, idle, params);
        long total = jdbc.queryForObject(SUMMARY + "SELECT COUNT(*) FROM summary" + where, params, Long.class);
        if (total == 0 || page.offset() >= total) return new SummaryPage(List.of(), total);
        params.addValue("limit", page.size()).addValue("offset", page.offset());
        List<CustomerSummary> items = jdbc.query(
                SUMMARY + "SELECT * FROM summary" + where + sort.orderBy() + " LIMIT :limit OFFSET :offset",
                params, ROW);
        return new SummaryPage(items, total);
    }

    public Optional<CustomerSummary> findById(long id) {
        return jdbc.query(SUMMARY + "SELECT * FROM summary WHERE id = :id", new MapSqlParameterSource("id", id), ROW)
                .stream().findFirst();
    }

    public CustomerPageResponse.Totals totals() {
        return jdbc.queryForObject(
                SUMMARY + "SELECT COUNT(*) AS customers, COALESCE(SUM(due), 0) AS due, "
                        + "COALESCE(SUM(bottles_held), 0) AS bottles_held, COALESCE(SUM(deposit_held), 0) AS deposit_held FROM summary",
                new MapSqlParameterSource(),
                (rs, n) -> new CustomerPageResponse.Totals(
                        rs.getLong("customers"), rs.getBigDecimal("due"), rs.getLong("bottles_held"), rs.getBigDecimal("deposit_held")));
    }

    private static String where(SearchKeyword keyword, IdleFilter idle, MapSqlParameterSource params) {
        List<String> conditions = new ArrayList<>();
        if (keyword != null) {
            params.addValue("keyword", keyword.text());
            // Cùng các trường trang Khách hàng từng tìm: mã KH-xxx, tên, điện thoại, khu vực, địa chỉ giao gần nhất.
            String text = """
                    (af_search_text(concat_ws(' ', 'KH-' || lpad(id::text, 3, '0'), full_name, phone, area, last_delivery_address))
                         LIKE '%' || af_search_text(:keyword) || '%'""";
            if (keyword.phone() != null && !keyword.phone().isEmpty()) {
                params.addValue("phone", keyword.phone());
                text += "\n     OR af_phone_digits(phone) LIKE '%' || :phone || '%'";
            }
            conditions.add(text + ")");
        }
        if (idle instanceof IdleFilter.Never) {
            conditions.add("last_order_at IS NULL");
        } else if (idle instanceof IdleFilter.MoreThanDays(int days, LocalDate today)) {
            conditions.add("last_order_at IS NOT NULL AND CAST(:today AS date) - (last_order_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date > :days");
            params.addValue("today", today).addValue("days", days);
        }
        return conditions.isEmpty() ? "" : " WHERE " + String.join(" AND ", conditions);
    }
}
