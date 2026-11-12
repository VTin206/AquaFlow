package com.aquaflow.inventory.repository;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

/** Sản phẩm bán chạy cho trang khách: xếp theo số lượng đã giao trong một khoảng thời gian gần đây. */
@Repository
public class BestSellerRepository {
    private final NamedParameterJdbcTemplate jdbc;

    public BestSellerRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Mã sản phẩm đang bán, xếp theo số lượng bán từ {@code since}, nhiều nhất trước.
     * Thời điểm bán giống báo cáo: lúc giao thành công, đơn tại quầy chưa ghi giao thì lấy lúc xuất kho gần nhất.
     * Chỉ tính đơn DELIVERED/COMPLETED; sản phẩm bán ít hơn {@code minQuantity} không được tính.
     */
    public List<Long> topProductIds(Instant since, int minQuantity, int limit) {
        return jdbc.queryForList("""
                SELECT oi.product_id
                FROM orders o
                LEFT JOIN LATERAL (
                    SELECT dispatched_at FROM order_dispatches d0 WHERE d0.order_id = o.id
                    ORDER BY d0.dispatched_at DESC, d0.id DESC LIMIT 1
                ) d ON TRUE
                JOIN order_items oi ON oi.order_id = o.id
                JOIN products p ON p.id = oi.product_id
                WHERE o.status IN ('DELIVERED', 'COMPLETED')
                  AND p.active
                  AND COALESCE(o.delivered_at, CASE WHEN o.fulfillment_type = 'COUNTER' THEN d.dispatched_at END) >= :since
                GROUP BY oi.product_id
                HAVING SUM(oi.quantity) >= :minQuantity
                ORDER BY SUM(oi.quantity) DESC, oi.product_id
                LIMIT :limit
                """, new MapSqlParameterSource()
                .addValue("since", java.sql.Timestamp.from(since))
                .addValue("minQuantity", minQuantity)
                .addValue("limit", limit), Long.class);
    }
}
