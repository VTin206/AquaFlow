package com.aquaflow.customer.order.repository;

import com.aquaflow.customer.order.application.OrderSearch;
import com.aquaflow.customer.order.domain.OrderStatus;
import com.aquaflow.shared.api.PageRequestParams;
import com.aquaflow.shared.api.SearchKeyword;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Truy vấn danh sách đơn có lọc/tìm/phân trang bằng SQL. Chỉ trả id theo đúng thứ tự;
 * OrderService nạp entity và dòng hàng theo lô để không lặp truy vấn từng đơn.
 */
@Repository
public class OrderQueryRepository {

    public record IdPage(List<Long> ids, long total) {
    }

    public record Balance(BigDecimal paid, BigDecimal due, BigDecimal refundDue, BigDecimal returned) {
        public static final Balance ZERO = new Balance(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);

        public Balance(BigDecimal paid, BigDecimal due, BigDecimal refundDue) {
            this(paid, due, refundDue, BigDecimal.ZERO);
        }
    }

    /** Đơn còn việc phải làm: chưa hoàn tất và chưa hủy (đơn đã giao nhưng chưa thu đủ vẫn thuộc nhóm này). */
    private static final String ACTIVE = "o.status NOT IN ('COMPLETED', 'CANCELLED')";

    /**
     * Mức ưu tiên xử lý, giống bảng Đơn hàng ở frontend (compareOrderPriority):
     * 0 giao thất bại, 1 quá giờ hẹn, 2 chờ xác nhận, 3 đang xử lý, 4 đã giao còn nợ, 5 xong/hủy.
     * Đơn quá giờ dùng cùng điều kiện với cảnh báo ORDER_OVERDUE.
     */
    private static final String PRIORITY_JOINS = """
             LEFT JOIN LATERAL (
                SELECT a.outcome FROM delivery_attempts a
                JOIN delivery_assignments da ON da.id = a.assignment_id
                WHERE da.order_id = o.id AND da.active
                ORDER BY a.attempted_at DESC, a.id DESC LIMIT 1
             ) last_attempt ON true
             CROSS JOIN LATERAL (
                SELECT CASE
                    WHEN o.status IN ('PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY') AND last_attempt.outcome = 'FAILED' THEN 0
                    WHEN o.status IN ('PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY') AND o.fulfillment_type = 'DELIVERY'
                        AND o.requested_delivery_at < CURRENT_TIMESTAMP THEN 1
                    WHEN o.status = 'PENDING' THEN 2
                    WHEN o.status IN ('CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY') THEN 3
                    WHEN o.status = 'DELIVERED' AND b.due > 0 THEN 4
                    ELSE 5 END AS rank
             ) priority""";

    /**
     * Trong từng mức: việc chờ lâu/trễ lâu trước (giờ hẹn, không hẹn thì lúc đặt); mức đang xử lý xếp theo giờ hẹn
     * gần nhất, đơn không hẹn giờ sau cùng; đơn đã xong/hủy mới nhất trước.
     */
    private static final String PRIORITY_ORDER = """
             ORDER BY priority.rank,
                CASE WHEN priority.rank = 3 THEN o.requested_delivery_at
                     WHEN priority.rank < 5 THEN COALESCE(o.requested_delivery_at, o.created_at) END ASC NULLS LAST,
                CASE WHEN priority.rank < 5 THEN o.created_at END ASC,
                o.created_at DESC, o.id DESC""";

    private final NamedParameterJdbcTemplate jdbc;

    public OrderQueryRepository(JdbcTemplate jdbc) {
        this.jdbc = new NamedParameterJdbcTemplate(jdbc);
    }

    public IdPage search(OrderSearch search, PageRequestParams page) {
        MapSqlParameterSource params = new MapSqlParameterSource();
        String where = where(search, params);
        long total = jdbc.queryForObject(
                "SELECT COUNT(*) FROM orders o JOIN order_payment_balances b ON b.order_id = o.id" + where,
                params, Long.class);
        if (total == 0 || page.offset() >= total) return new IdPage(List.of(), total);
        params.addValue("limit", page.size()).addValue("offset", page.offset());
        List<Long> ids = jdbc.queryForList(
                "SELECT o.id FROM orders o JOIN order_payment_balances b ON b.order_id = o.id " + PRIORITY_JOINS + where
                        + " " + PRIORITY_ORDER + " LIMIT :limit OFFSET :offset",
                params, Long.class);
        return new IdPage(ids, total);
    }

    /** Số đơn theo trạng thái trên toàn bộ đơn; trạng thái chưa có đơn vẫn có mặt với giá trị 0. */
    public Map<OrderStatus, Long> statusCounts() {
        Map<OrderStatus, Long> counts = new EnumMap<>(OrderStatus.class);
        for (OrderStatus status : OrderStatus.values()) counts.put(status, 0L);
        jdbc.query("SELECT status, COUNT(*) AS n FROM orders GROUP BY status", rs -> {
            counts.put(OrderStatus.valueOf(rs.getString("status")), rs.getLong("n"));
        });
        return counts;
    }

    /**
     * Tập đơn các màn hình vận hành cần (đếm chờ xác nhận, Tổng quan, giao hàng, gợi ý khi nhận đơn):
     * mọi đơn còn việc phải làm cộng với đơn tạo từ {@code since}. Không phụ thuộc tổng số đơn lịch sử.
     */
    public List<Long> workingSetIds(OffsetDateTime since) {
        return jdbc.queryForList(
                "SELECT o.id FROM orders o WHERE " + ACTIVE + " OR o.created_at >= :since ORDER BY o.created_at DESC, o.id DESC",
                new MapSqlParameterSource("since", since), Long.class);
    }

    public List<Long> customerOrderIds(long customerId) {
        return jdbc.queryForList(
                "SELECT o.id FROM orders o WHERE o.customer_id = :customerId ORDER BY o.created_at DESC, o.id DESC",
                new MapSqlParameterSource("customerId", customerId), Long.class);
    }

    public Map<Long, Balance> balances(Collection<Long> orderIds) {
        Map<Long, Balance> balances = new HashMap<>();
        if (orderIds.isEmpty()) return balances;
        jdbc.query("SELECT order_id, paid, due, refund_due, returned FROM order_payment_balances WHERE order_id IN (:ids)",
                new MapSqlParameterSource("ids", orderIds),
                rs -> {
                    balances.put(rs.getLong("order_id"),
                            new Balance(rs.getBigDecimal("paid"), rs.getBigDecimal("due"), rs.getBigDecimal("refund_due"),
                                    rs.getBigDecimal("returned")));
                });
        return balances;
    }

    private static String where(OrderSearch search, MapSqlParameterSource params) {
        List<String> conditions = new ArrayList<>();
        if (!search.statuses().isEmpty()) {
            conditions.add("o.status IN (:statuses)");
            params.addValue("statuses", search.statuses().stream().map(Enum::name).toList());
        }
        if (search.fulfillmentType() != null) {
            conditions.add("o.fulfillment_type = :fulfillment");
            params.addValue("fulfillment", search.fulfillmentType().name());
        }
        if (search.payment() != null) {
            // Giống bộ lọc cũ ở frontend: đơn hủy không tính là còn phải thu hay đã thanh toán.
            conditions.add(search.payment() == OrderSearch.PaymentFilter.DUE
                    ? "o.status <> 'CANCELLED' AND b.due > 0"
                    : "o.status <> 'CANCELLED' AND b.due = 0");
        }
        SearchKeyword keyword = search.keyword();
        if (keyword != null) {
            params.addValue("keyword", keyword.text());
            String text = """
                    (af_search_text(concat_ws(' ', o.order_code, o.recipient_name, o.recipient_phone))
                         LIKE '%' || af_search_text(:keyword) || '%'
                     OR EXISTS (SELECT 1 FROM order_items i JOIN products p ON p.id = i.product_id
                                WHERE i.order_id = o.id AND af_search_text(p.name) LIKE '%' || af_search_text(:keyword) || '%')""";
            if (keyword.phone() != null && !keyword.phone().isEmpty()) {
                params.addValue("phone", keyword.phone());
                text += "\n     OR af_phone_digits(o.recipient_phone) LIKE '%' || :phone || '%'";
            }
            conditions.add(text + ")");
        }
        return conditions.isEmpty() ? "" : " WHERE " + String.join(" AND ", conditions);
    }
}
