package com.aquaflow.inventory.repository;

import com.aquaflow.inventory.api.ReturnDtos.*;
import com.aquaflow.shared.api.NotFoundException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

@Repository
public class InventoryReturnRepository {
    private final JdbcTemplate jdbc;
    public InventoryReturnRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    // Only the most recent trip owns the physical goods. Active reassignment excludes a return.
    private static final String PENDING = """
        SELECT o.id, o.order_code, o.recipient_name, a.id AS assignment_id, da.failure_reason
        FROM orders o
        JOIN LATERAL (SELECT * FROM delivery_assignments x WHERE x.order_id=o.id
            AND EXISTS (SELECT 1 FROM delivery_load_items l WHERE l.assignment_id=x.id)
            ORDER BY x.id DESC LIMIT 1) a ON TRUE
        JOIN delivery_trips t ON t.id=a.trip_id
        JOIN LATERAL (SELECT * FROM delivery_attempts x WHERE x.assignment_id=a.id ORDER BY x.attempt_no DESC LIMIT 1) da ON TRUE
        WHERE o.status='OUT_FOR_DELIVERY' AND o.fulfillment_type='DELIVERY'
          AND t.status='COMPLETED' AND da.outcome='FAILED'
          AND NOT EXISTS (SELECT 1 FROM delivery_assignments x WHERE x.order_id=o.id AND x.active)
          AND NOT EXISTS (SELECT 1 FROM inventory_returns r WHERE r.order_id=o.id)
        """;

    public List<Pending> pending() {
        return jdbc.query(PENDING + " ORDER BY o.id", (rs, n) -> new Pending(rs.getLong("id"),
            rs.getString("order_code"), rs.getString("recipient_name"), rs.getLong("assignment_id"),
            rs.getString("failure_reason"), lines(rs.getLong("assignment_id"), null)));
    }
    public void lockOrder(long id) {
        if (jdbc.query("SELECT id FROM orders WHERE id=? FOR UPDATE", (rs,n)->rs.getLong(1), id).isEmpty())
            throw new NotFoundException("Không tìm thấy đơn hàng");
    }
    public List<Line> lines(long assignmentId, Long returnId) {
        return jdbc.query("""
            SELECT l.id, l.batch_id, p.name, b.lot_code, b.expires_on,
                   l.quantity_loaded-l.quantity_delivered AS quantity, r.sellable
            FROM delivery_load_items l JOIN product_batches b ON b.id=l.batch_id
            JOIN products p ON p.id=b.product_id
            LEFT JOIN inventory_return_lines r ON r.load_item_id=l.id AND r.return_id=?
            WHERE l.assignment_id=? ORDER BY b.product_id, b.expires_on, b.id, l.id
            """, (rs,n)->new Line(rs.getLong("id"), rs.getLong("batch_id"), rs.getString("name"),
                rs.getString("lot_code"), rs.getObject("expires_on", LocalDate.class),
                rs.getInt("quantity"), rs.getObject("sellable", Integer.class)), returnId, assignmentId);
    }
    public List<Inspection> list(int page, int size) {
        return jdbc.query("SELECT id FROM inventory_returns ORDER BY id DESC LIMIT ? OFFSET ?",
            (rs,n)->rs.getLong(1), size, (long)page*size).stream().map(this::get).toList();
    }
    public Inspection get(long id) {
        return jdbc.query("""
            SELECT r.*, o.order_code FROM inventory_returns r JOIN orders o ON o.id=r.order_id WHERE r.id=?
            """, (rs,n)->new Inspection(rs.getLong("id"), rs.getLong("order_id"), rs.getString("order_code"),
                rs.getLong("assignment_id"), rs.getLong("performed_by"),
                rs.getObject("created_at", OffsetDateTime.class), rs.getString("note"),
                lines(rs.getLong("assignment_id"), id)), id).stream().findFirst()
                .orElseThrow(()->new NotFoundException("Không tìm thấy phiếu hoàn hàng"));
    }
    public long create(Pending pending, long actor, String note) {
        return jdbc.queryForObject("INSERT INTO inventory_returns(order_id,assignment_id,performed_by,note) VALUES (?,?,?,?) RETURNING id",
            Long.class, pending.orderId(), pending.assignmentId(), actor, note);
    }
    public void receive(long id, long orderId, Line line, int sellable, long actor, String note) {
        jdbc.update("INSERT INTO inventory_return_lines(return_id,load_item_id,quantity,sellable) VALUES (?,?,?,?)",
            id, line.loadItemId(), line.quantity(), sellable);
        jdbc.update("UPDATE delivery_load_items SET quantity_returned=? WHERE id=?", line.quantity(), line.loadItemId());
        if (sellable > 0) {
            jdbc.update("""
                INSERT INTO inventory_balances(batch_id,on_hand) VALUES (?,?)
                ON CONFLICT(batch_id) DO UPDATE SET on_hand=inventory_balances.on_hand+EXCLUDED.on_hand,
                    version=inventory_balances.version+1
                """, line.batchId(), sellable);
            jdbc.update("""
                INSERT INTO inventory_movements(batch_id,movement_type,quantity,reference_type,reference_id,performed_by,reason)
                VALUES (?,'RETURN',?,'ORDER',?,?,?)
                """, line.batchId(), sellable, orderId, actor, note);
        }
    }
    public void closeOrder(long orderId) {
        jdbc.update("UPDATE orders SET status='CANCELLED',cancelled_at=NOW() WHERE id=?", orderId);
    }
}
