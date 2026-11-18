package com.aquaflow.customer.order.repository;

import com.aquaflow.customer.order.domain.FulfillmentType;
import com.aquaflow.customer.order.domain.OrderStatus;
import com.aquaflow.customer.order.domain.PaymentStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

/** Đọc đơn cho trang tra cứu công khai; số đã trả/còn phải trả lấy từ order_payment_balances như sổ thanh toán. */
@Repository
public class OrderTrackingRepository {

    /** Dữ liệu đơn kèm số điện thoại thật (chỉ dùng để đối chiếu, không trả ra ngoài). */
    public record Row(
            long id, String orderCode, OrderStatus status, FulfillmentType fulfillmentType,
            PaymentStatus paymentStatus, boolean deliveryFailed, String recipientName, String recipientPhone,
            String deliveryAddress, String deliveryArea, OffsetDateTime requestedDeliveryAt,
            BigDecimal subtotal, BigDecimal discountAmount, BigDecimal deliveryFee, BigDecimal total,
            BigDecimal paid, BigDecimal due, OffsetDateTime createdAt, OffsetDateTime confirmedAt,
            OffsetDateTime deliveredAt, OffsetDateTime cancelledAt, String trackingToken) {
    }

    public record ItemRow(Long productId, String productName, String unit, Integer quantity,
            BigDecimal unitPrice, BigDecimal lineTotal) {
    }

    private static final String SELECT = """
            SELECT o.id, o.order_code, o.status, o.fulfillment_type, o.payment_status, o.delivery_failed,
                   o.recipient_name, o.recipient_phone, o.delivery_address, o.delivery_area,
                   o.requested_delivery_at, o.subtotal, o.discount_amount, o.delivery_fee,
                   b.total, b.paid, b.due, o.created_at, o.confirmed_at, o.delivered_at, o.cancelled_at,
                   o.tracking_token
            FROM orders o JOIN order_payment_balances b ON b.order_id = o.id
            """;

    private static final RowMapper<Row> ROW = (rs, n) -> new Row(
            rs.getLong("id"),
            rs.getString("order_code"),
            OrderStatus.valueOf(rs.getString("status")),
            FulfillmentType.valueOf(rs.getString("fulfillment_type")),
            PaymentStatus.valueOf(rs.getString("payment_status")),
            rs.getBoolean("delivery_failed"),
            rs.getString("recipient_name"),
            rs.getString("recipient_phone"),
            rs.getString("delivery_address"),
            rs.getString("delivery_area"),
            rs.getObject("requested_delivery_at", OffsetDateTime.class),
            rs.getBigDecimal("subtotal"),
            rs.getBigDecimal("discount_amount"),
            rs.getBigDecimal("delivery_fee"),
            rs.getBigDecimal("total"),
            rs.getBigDecimal("paid"),
            rs.getBigDecimal("due"),
            rs.getObject("created_at", OffsetDateTime.class),
            rs.getObject("confirmed_at", OffsetDateTime.class),
            rs.getObject("delivered_at", OffsetDateTime.class),
            rs.getObject("cancelled_at", OffsetDateTime.class),
            rs.getString("tracking_token"));

    private static final RowMapper<ItemRow> ITEM = (rs, n) -> new ItemRow(
            rs.getLong("product_id"),
            rs.getString("name"),
            rs.getString("unit"),
            rs.getInt("quantity"),
            rs.getBigDecimal("unit_price"),
            rs.getBigDecimal("line_total"));

    private final JdbcTemplate jdbc;

    public OrderTrackingRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<Row> findByOrderCode(String orderCode) {
        return jdbc.query(SELECT + " WHERE o.order_code = ?", ROW, orderCode).stream().findFirst();
    }

    public Optional<Row> findByTrackingToken(String token) {
        return jdbc.query(SELECT + " WHERE o.tracking_token = ?", ROW, token).stream().findFirst();
    }

    public List<ItemRow> items(long orderId) {
        return jdbc.query("""
                SELECT i.product_id, p.name, p.unit, i.quantity, i.unit_price, i.line_total
                FROM order_items i JOIN products p ON p.id = i.product_id
                WHERE i.order_id = ? ORDER BY i.id
                """, ITEM, orderId);
    }

    /** Cấp khóa cho đơn tạo trước khi có tính năng tra cứu; hai yêu cầu đồng thời vẫn nhận cùng một khóa. */
    public String issueTrackingToken(long orderId, String candidate) {
        jdbc.update("UPDATE orders SET tracking_token = ? WHERE id = ? AND tracking_token IS NULL", candidate, orderId);
        return jdbc.queryForObject("SELECT tracking_token FROM orders WHERE id = ?", String.class, orderId);
    }
}
