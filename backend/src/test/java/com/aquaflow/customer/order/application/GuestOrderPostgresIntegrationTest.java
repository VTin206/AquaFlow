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

    @Test
    void guestOrderPersistsPendingWithoutCustomerOrReservation() {
        GuestOrderCreateRequest request = new GuestOrderCreateRequest(
                "Guest Customer",
                "0901234567",
                "123 Nguyen Trai",
                "Quan 5",
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
