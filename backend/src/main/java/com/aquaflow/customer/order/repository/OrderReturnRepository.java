package com.aquaflow.customer.order.repository;

import com.aquaflow.customer.order.api.dto.OrderReturnDtos.LineResponse;
import com.aquaflow.customer.order.api.dto.OrderReturnDtos.Response;
import com.aquaflow.customer.order.api.dto.OrderReturnDtos.Returnable;
import com.aquaflow.shared.api.NotFoundException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class OrderReturnRepository {
    private final JdbcTemplate jdbc;

    public OrderReturnRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record OrderRow(long id, String orderCode, String status, String fulfillmentType) {
    }

    public record Replay(long id, long orderId, String hash) {
    }

    /** Lô khách đã nhận của một dòng hàng và số còn có thể nhập lại kho từ lô đó. */
    public record ReceivedBatch(long batchId, String lotCode, LocalDate expiresOn, int remaining) {
    }

    /** Giá trị hàng trả: số lượng × đơn giá × tỷ lệ sau giảm giá của đơn, như báo cáo doanh thu và view số dư. */
    private static final String ITEM_VALUE = """
            ri.quantity * oi.unit_price * CASE WHEN o.subtotal > 0 THEN (o.subtotal - o.discount_amount) / o.subtotal ELSE 1 END
            """;

    public OrderRow lockOrder(long id) {
        return jdbc.query("SELECT id, order_code, status, fulfillment_type FROM orders WHERE id = ? FOR UPDATE",
                        (rs, n) -> new OrderRow(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getString(4)), id)
                .stream().findFirst().orElseThrow(() -> new NotFoundException("Không tìm thấy đơn hàng"));
    }

    public void requireOrder(long id) {
        if (jdbc.queryForList("SELECT id FROM orders WHERE id = ?", Long.class, id).isEmpty())
            throw new NotFoundException("Không tìm thấy đơn hàng");
    }

    public Optional<Replay> replay(UUID requestId) {
        return jdbc.query("SELECT id, order_id, request_hash FROM order_returns WHERE request_id = ?",
                (rs, n) -> new Replay(rs.getLong(1), rs.getLong(2), rs.getString(3)), requestId).stream().findFirst();
    }

    public List<Returnable> returnable(long orderId) {
        return jdbc.query("""
                SELECT oi.id, oi.product_id, p.name, oi.quantity, oi.unit_price,
                       COALESCE((SELECT SUM(ri.quantity) FROM order_return_items ri WHERE ri.order_item_id = oi.id), 0) AS returned
                FROM order_items oi JOIN products p ON p.id = oi.product_id
                WHERE oi.order_id = ? ORDER BY oi.id
                """, (rs, n) -> {
            int ordered = rs.getInt("quantity");
            int returned = rs.getInt("returned");
            return new Returnable(rs.getLong("id"), rs.getLong("product_id"), rs.getString("name"), ordered, returned,
                    Math.max(0, ordered - returned), rs.getBigDecimal("unit_price"));
        }, orderId);
    }

    public long create(long orderId, String reason, boolean restocked, long actor, UUID requestId, String hash) {
        return jdbc.queryForObject("""
                INSERT INTO order_returns(order_id, reason, restocked, performed_by, request_id, request_hash)
                VALUES (?, ?, ?, ?, ?, ?) RETURNING id
                """, Long.class, orderId, reason, restocked, actor, requestId, hash);
    }

    public void addItem(long returnId, long orderItemId, int quantity) {
        jdbc.update("INSERT INTO order_return_items(return_id, order_item_id, quantity) VALUES (?, ?, ?)",
                returnId, orderItemId, quantity);
    }

    /**
     * Lô khách đã nhận: giao tận nơi lấy theo lần giao thành công, bán tại quầy lấy theo phiếu xuất.
     * Lô hạn dùng xa nhất trước để hàng nhập lại còn bán được lâu nhất.
     */
    public List<ReceivedBatch> receivedBatches(long orderId, String fulfillmentType, long orderItemId) {
        String received = "DELIVERY".equals(fulfillmentType) ? """
                SELECT l.batch_id, SUM(l.quantity_delivered) AS quantity
                FROM delivery_load_items l JOIN delivery_assignments a ON a.id = l.assignment_id
                WHERE a.order_id = ? AND l.order_item_id = ? AND l.quantity_delivered > 0 GROUP BY l.batch_id
                """ : """
                SELECT i.batch_id, SUM(i.quantity) AS quantity
                FROM order_dispatch_items i JOIN order_dispatches d ON d.id = i.dispatch_id
                WHERE d.order_id = ? AND i.order_item_id = ? GROUP BY i.batch_id
                """;
        return jdbc.query("""
                SELECT b.id, b.lot_code, b.expires_on,
                       r.quantity - COALESCE((SELECT SUM(x.quantity) FROM order_return_batches x
                                              WHERE x.order_item_id = ? AND x.batch_id = b.id), 0) AS remaining
                FROM (%s) r JOIN product_batches b ON b.id = r.batch_id
                ORDER BY b.expires_on DESC, b.id DESC
                """.formatted(received), (rs, n) -> new ReceivedBatch(rs.getLong("id"), rs.getString("lot_code"),
                rs.getObject("expires_on", LocalDate.class), rs.getInt("remaining")), orderItemId, orderId, orderItemId);
    }

    /** Nhập lại kho một phần hàng trả vào lô khách đã nhận (phiếu RETURN theo đơn). */
    public void restock(long returnId, long orderId, long orderItemId, long batchId, int quantity, long actor, String reason) {
        jdbc.update("INSERT INTO order_return_batches(return_id, order_item_id, batch_id, quantity) VALUES (?, ?, ?, ?)",
                returnId, orderItemId, batchId, quantity);
        jdbc.update("""
                INSERT INTO inventory_balances(batch_id, on_hand) VALUES (?, ?)
                ON CONFLICT(batch_id) DO UPDATE SET on_hand = inventory_balances.on_hand + EXCLUDED.on_hand,
                    version = inventory_balances.version + 1
                """, batchId, quantity);
        jdbc.update("""
                INSERT INTO inventory_movements(batch_id, movement_type, quantity, reference_type, reference_id, performed_by, reason)
                VALUES (?, 'RETURN', ?, 'ORDER', ?, ?, ?)
                """, batchId, quantity, orderId, actor, reason);
    }

    public BigDecimal refundDue(long orderId) {
        return jdbc.queryForObject("SELECT refund_due FROM order_payment_balances WHERE order_id = ?", BigDecimal.class, orderId);
    }

    public void refreshPaymentStatus(long orderId) {
        jdbc.queryForObject("SELECT refresh_order_payment_status(?)", Object.class, orderId);
    }

    public void recordRefund(long returnId, BigDecimal amount, long paymentId) {
        jdbc.update("UPDATE order_returns SET refunded = ?, payment_id = ? WHERE id = ?", amount, paymentId, returnId);
    }

    public List<Response> list(long orderId) {
        return jdbc.queryForList("SELECT id FROM order_returns WHERE order_id = ? ORDER BY created_at, id", Long.class, orderId)
                .stream().map(this::get).toList();
    }

    public Response get(long id) {
        List<LineResponse> lines = jdbc.query("""
                SELECT ri.order_item_id, oi.product_id, p.name, ri.quantity, oi.unit_price, ROUND(%s, 2) AS value
                FROM order_return_items ri JOIN order_items oi ON oi.id = ri.order_item_id
                JOIN orders o ON o.id = oi.order_id JOIN products p ON p.id = oi.product_id
                WHERE ri.return_id = ? ORDER BY ri.id
                """.formatted(ITEM_VALUE), (rs, n) -> new LineResponse(rs.getLong(1), rs.getLong(2), rs.getString(3),
                rs.getInt(4), rs.getBigDecimal(5), rs.getBigDecimal(6)), id);
        return jdbc.query("""
                SELECT r.*, o.order_code, u.full_name,
                       (SELECT ROUND(SUM(%s), 2) FROM order_return_items ri JOIN order_items oi ON oi.id = ri.order_item_id
                        WHERE ri.return_id = r.id) AS value
                FROM order_returns r JOIN orders o ON o.id = r.order_id JOIN users u ON u.id = r.performed_by
                WHERE r.id = ?
                """.formatted(ITEM_VALUE), (rs, n) -> new Response(rs.getLong("id"), rs.getLong("order_id"),
                rs.getString("order_code"), rs.getObject("created_at", OffsetDateTime.class), rs.getLong("performed_by"),
                rs.getString("full_name"), rs.getString("reason"), rs.getBoolean("restocked"), rs.getBigDecimal("value"),
                rs.getBigDecimal("refunded"), rs.getObject("payment_id", Long.class), lines), id)
                .stream().findFirst().orElseThrow(() -> new NotFoundException("Không tìm thấy phiếu trả hàng"));
    }
}
