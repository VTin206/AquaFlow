package com.aquaflow.inventory.repository;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

/** Đọc số hàng đã chở đi và đã kiểm nhận trả về của từng dòng đơn từ delivery_load_items. */
@Repository
public class RedeliveryEligibilityRepository {
    private final NamedParameterJdbcTemplate jdbc;

    public RedeliveryEligibilityRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** returned: đã kiểm nhận về kho; outside: đã chở đi nhưng chưa giao và chưa kiểm nhận. */
    public record LoadSummary(long orderItemId, int returned, int outside) {
    }

    public List<LoadSummary> summarize(Collection<Long> orderItemIds) {
        return jdbc.query("""
                SELECT order_item_id,
                       COALESCE(SUM(quantity_returned), 0) AS returned,
                       COALESCE(SUM(quantity_loaded - quantity_delivered - quantity_returned), 0) AS outside
                FROM delivery_load_items WHERE order_item_id IN (:ids) GROUP BY order_item_id
                """, new MapSqlParameterSource("ids", orderItemIds),
                (rs, n) -> new LoadSummary(rs.getLong("order_item_id"), rs.getInt("returned"), rs.getInt("outside")));
    }
}
