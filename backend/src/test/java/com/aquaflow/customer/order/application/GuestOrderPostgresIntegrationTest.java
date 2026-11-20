package com.aquaflow.customer.order.application;

import com.aquaflow.customer.order.api.dto.GuestOrderCreateRequest;
import com.aquaflow.customer.order.api.dto.OrderItemRequest;
import com.aquaflow.customer.order.api.dto.OrderResponse;
import com.aquaflow.customer.order.domain.OrderStatus;
import com.aquaflow.inventory.repository.ProductRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Runs against PostgreSQL when CI provides DB_URL. */
@SpringBootTest(properties = "app.jwt.secret=test-test-test-test-test-test-test-test")
@EnabledIfEnvironmentVariable(named = "DB_URL", matches = ".+")
class GuestOrderPostgresIntegrationTest {

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private OrderService orderService;

    private Long productId;
    private Long orderId;

    @BeforeEach
    void setUp() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        productId = jdbc.queryForObject(
                "INSERT INTO products (sku, name, unit, sale_price) VALUES (?, 'Guest order test', 'binh', 20000) RETURNING id",
                Long.class,
                "GST-" + suffix);
    }

    @AfterEach
    void tearDown() {
        if (orderId != null) {
            jdbc.update("DELETE FROM stock_reservations WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = ?)", orderId);
            jdbc.update("DELETE FROM order_items WHERE order_id = ?", orderId);
            jdbc.update("DELETE FROM orders WHERE id = ?", orderId);
        }
        if (productId != null) {
            jdbc.update("DELETE FROM products WHERE id = ?", productId);
        }
    }

    @Autowired
    private OrderTrackingService tracking;

    private GuestOrderCreateRequest guestOrder(com.aquaflow.customer.order.domain.PaymentMethod paymentMethod) {
        return new GuestOrderCreateRequest(
                "Guest Customer", "0901234567", "123 Nguyen Trai", "Phường Chợ Quán", null,
                List.of(new OrderItemRequest(productId, 1)), null, 0, null, null, paymentMethod);
    }

    @Test
    void guestOrderWithoutPaymentChoiceIsStoredAsCashOnDeliveryForStaffAndTracking() {
        OrderResponse response = orderService.createForGuest(guestOrder(null));
        orderId = response.id();

        assertThat(response.paymentMethod()).isEqualTo(com.aquaflow.customer.order.domain.PaymentMethod.COD);
        assertThat(tracking.byToken(response.trackingToken()).paymentMethod())
                .isEqualTo(com.aquaflow.customer.order.domain.PaymentMethod.COD);
        assertThat(jdbc.queryForObject("SELECT payment_method FROM orders WHERE id = ?", String.class, orderId))
                .isEqualTo("COD");
        // Ràng buộc trong DB chỉ nhận COD/TRANSFER, kể cả khi ghi thẳng bằng SQL.
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> jdbc.update(
                        "UPDATE orders SET payment_method = 'CARD' WHERE id = ?", orderId))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }

    @Test
    void transferBeforeDeliveryNeedsThePublishedBankAccount() {
        String saved = jdbc.queryForObject("SELECT settings::text FROM store_settings WHERE id = 1", String.class);
        try {
            jdbc.update("""
                    UPDATE store_settings SET settings = settings - 'bankName' - 'bankAccount' - 'bankHolder' WHERE id = 1
                    """);
            org.assertj.core.api.Assertions.assertThatThrownBy(() -> orderService.createForGuest(
                            guestOrder(com.aquaflow.customer.order.domain.PaymentMethod.TRANSFER)))
                    .isInstanceOf(com.aquaflow.shared.api.BadRequestException.class);

            jdbc.update("""
                    UPDATE store_settings SET settings = settings
                        || '{"bankName":"Vietcombank","bankAccount":"0123456789","bankHolder":"AQUAFLOW"}'::jsonb
                    WHERE id = 1
                    """);
            OrderResponse response = orderService.createForGuest(
                    guestOrder(com.aquaflow.customer.order.domain.PaymentMethod.TRANSFER));
            orderId = response.id();
            assertThat(response.paymentMethod()).isEqualTo(com.aquaflow.customer.order.domain.PaymentMethod.TRANSFER);
            assertThat(tracking.byToken(response.trackingToken()).paymentMethod())
                    .isEqualTo(com.aquaflow.customer.order.domain.PaymentMethod.TRANSFER);
        } finally {
            jdbc.update("UPDATE store_settings SET settings = CAST(? AS jsonb) WHERE id = 1", saved);
        }
    }

    @Test
    void counterOrderIgnoresThePaymentChoice() {
        OrderResponse response = orderService.createForStaff(new com.aquaflow.customer.order.api.dto.OrderCreateRequest(
                null, com.aquaflow.customer.order.domain.OrderChannel.COUNTER,
                com.aquaflow.customer.order.domain.FulfillmentType.COUNTER, null, null, null, null, null,
                List.of(new OrderItemRequest(productId, 1)), null, 0, null, null,
                com.aquaflow.customer.order.domain.PaymentMethod.TRANSFER), null);
        orderId = response.id();

        assertThat(response.paymentMethod()).isNull();
    }

    @Test
    void guestOrderKeepsChosenDeliveryWindowForStaffAndTracking() {
        java.time.OffsetDateTime from = java.time.OffsetDateTime.parse("2030-03-04T14:00:00+07:00");
        java.time.OffsetDateTime until = java.time.OffsetDateTime.parse("2030-03-04T17:00:00+07:00");
        GuestOrderCreateRequest request = new GuestOrderCreateRequest(
                "Guest Customer", "0901234567", "123 Nguyen Trai", "Phường Chợ Quán", from,
                List.of(new OrderItemRequest(productId, 1)), null, 0, null, until);

        OrderResponse response = orderService.createForGuest(request);
        orderId = response.id();

        assertThat(response.requestedDeliveryAt()).isEqualTo(from);
        assertThat(response.requestedDeliveryUntil()).isEqualTo(until);
        assertThat(tracking.byToken(response.trackingToken()).requestedDeliveryUntil()).isEqualTo(until);
        // Ràng buộc trong DB chặn khung kết thúc trước khi bắt đầu, kể cả khi ghi thẳng bằng SQL.
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> jdbc.update(
                        "UPDATE orders SET requested_delivery_until = requested_delivery_at - INTERVAL '1 hour' WHERE id = ?", orderId))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }

    @Test
    void guestOrderPersistsPendingWithoutCustomerOrReservation() {
        GuestOrderCreateRequest request = new GuestOrderCreateRequest(
                "Guest Customer",
                "0901234567",
                "123 Nguyen Trai",
                "Phường Chợ Quán",
                null,
                List.of(new OrderItemRequest(productId, 2)),
                "Guest PostgreSQL test");

        OrderResponse response = orderService.createForGuest(request);
        orderId = response.id();

        assertThat(response.status()).isEqualTo(OrderStatus.PENDING);
        assertThat(response.customerId()).isNull();
        assertThat(response.createdBy()).isNull();
        assertThat(response.subtotal()).isEqualByComparingTo(new BigDecimal("40000"));
        assertThat(jdbc.queryForObject(
                "SELECT status FROM orders WHERE id = ?", String.class, orderId))
                .isEqualTo("PENDING");
        assertThat(jdbc.queryForObject(
                "SELECT customer_id FROM orders WHERE id = ?", Long.class, orderId))
                .isNull();
        assertThat(jdbc.queryForObject(
                "SELECT unit_price FROM order_items WHERE order_id = ?", BigDecimal.class, orderId))
                .isEqualByComparingTo(new BigDecimal("20000"));
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM stock_reservations r JOIN order_items i ON i.id = r.order_item_id WHERE i.order_id = ?",
                Integer.class,
                orderId)).isZero();
    }
}
