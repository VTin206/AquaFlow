package com.aquaflow.customer.order.repository;

import com.aquaflow.customer.order.api.dto.DispatchResponse;
import com.aquaflow.customer.order.domain.OrderStatus;
import com.aquaflow.inventory.application.DispatchedLine;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public class DispatchRepository {
    private final JdbcTemplate jdbc;
    public DispatchRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public DispatchResponse create(Long orderId, Long actorId, OrderStatus status, List<DispatchedLine> items) {
        Long id = jdbc.queryForObject("""
                INSERT INTO order_dispatches (order_id, performed_by, order_status)
                VALUES (?, ?, ?) RETURNING id
                """, Long.class, orderId, actorId, status.name());
        for (var item : items) {
            jdbc.update("""
                    INSERT INTO order_dispatch_items
                    (dispatch_id, order_item_id, product_id, batch_id, lot_code, expires_on, quantity)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, id, item.orderItemId(), item.productId(), item.batchId(), item.lotCode(), item.expiresOn(), item.quantity());
        }
        return findById(id).orElseThrow();
    }

    public List<DispatchResponse> findAllByOrderId(Long orderId) {
        return jdbc.query("SELECT * FROM order_dispatches WHERE order_id = ? ORDER BY dispatched_at DESC, id DESC", (rs, row) -> {
            Long id = rs.getLong("id");
            var items = jdbc.query("SELECT * FROM order_dispatch_items WHERE dispatch_id = ? ORDER BY id",
                    (line, index) -> new DispatchedLine(line.getLong("order_item_id"), line.getLong("product_id"),
                            line.getLong("batch_id"), line.getString("lot_code"),
                            line.getDate("expires_on").toLocalDate(), line.getInt("quantity")), id);
            return new DispatchResponse(id, orderId, rs.getLong("performed_by"),
                    rs.getObject("dispatched_at", OffsetDateTime.class), OrderStatus.valueOf(rs.getString("order_status")), items);
        }, orderId);
    }

    public Optional<DispatchResponse> findById(Long dispatchId) {
        return jdbc.query("SELECT * FROM order_dispatches WHERE id = ?", (rs, row) -> {
            Long id = rs.getLong("id");
            Long orderId = rs.getLong("order_id");
            var items = jdbc.query("SELECT * FROM order_dispatch_items WHERE dispatch_id = ? ORDER BY id",
                    (line, index) -> new DispatchedLine(line.getLong("order_item_id"), line.getLong("product_id"),
                            line.getLong("batch_id"), line.getString("lot_code"),
                            line.getDate("expires_on").toLocalDate(), line.getInt("quantity")), id);
            return new DispatchResponse(id, orderId, rs.getLong("performed_by"),
                    rs.getObject("dispatched_at", OffsetDateTime.class), OrderStatus.valueOf(rs.getString("order_status")), items);
        }, dispatchId).stream().findFirst();
    }

    public boolean hasDispatch(Long orderId) {
        return Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT EXISTS(SELECT 1 FROM order_dispatches WHERE order_id = ?)", Boolean.class, orderId));
    }

}
