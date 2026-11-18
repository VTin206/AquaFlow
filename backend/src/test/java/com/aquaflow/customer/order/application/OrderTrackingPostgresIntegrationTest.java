package com.aquaflow.customer.order.application;

import com.aquaflow.customer.order.api.dto.GuestOrderCreateRequest;
import com.aquaflow.customer.order.api.dto.OrderItemRequest;
import com.aquaflow.customer.order.api.dto.OrderResponse;
import com.aquaflow.shared.api.NotFoundException;
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
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Chạy trên PostgreSQL khi CI cung cấp DB_URL: kiểm tra câu SQL tra cứu với view order_payment_balances thật. */
@SpringBootTest(properties = "app.jwt.secret=test-test-test-test-test-test-test-test")
@EnabledIfEnvironmentVariable(named = "DB_URL", matches = ".+")
class OrderTrackingPostgresIntegrationTest {

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private OrderService orderService;

    @Autowired
    private OrderTrackingService trackingService;

    private Long productId;
    private Long orderId;

    @BeforeEach
    void setUp() {
        productId = jdbc.queryForObject(
                "INSERT INTO products (sku, name, unit, sale_price) VALUES (?, 'Tracking test', 'Bình', 20000) RETURNING id",
                Long.class,
                "TRK-" + UUID.randomUUID().toString().substring(0, 8));
    }

    @AfterEach
    void tearDown() {
        if (orderId != null) {
            jdbc.update("DELETE FROM order_items WHERE order_id = ?", orderId);
            jdbc.update("DELETE FROM orders WHERE id = ?", orderId);
        }
        jdbc.update("DELETE FROM products WHERE id = ?", productId);
    }

    @Test
    void guestCanTrackOrderByCodeAndPhoneOrByLink() {
        OrderResponse created = orderService.createForGuest(new GuestOrderCreateRequest(
                "Khách tra cứu", "0901234567", "123 Nguyễn Trãi", "Phường Chợ Quán", null,
                List.of(new OrderItemRequest(productId, 2)), null));
        orderId = created.id();
        assertThat(created.trackingToken()).matches("[A-Za-z0-9_-]{43}");

        var byCode = trackingService.lookup(created.orderCode().toLowerCase(), "+84 901 234 567");
        assertThat(byCode.trackingToken()).isEqualTo(created.trackingToken());
        assertThat(byCode.recipientPhone()).isEqualTo("090****567");
        assertThat(byCode.subtotal()).isEqualByComparingTo(new BigDecimal("40000"));
        assertThat(byCode.due()).isEqualByComparingTo(created.total());
        assertThat(byCode.paid()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(byCode.items()).singleElement().satisfies(item -> {
            assertThat(item.productName()).isEqualTo("Tracking test");
            assertThat(item.unit()).isEqualTo("Bình");
            assertThat(item.quantity()).isEqualTo(2);
        });

        var byLink = trackingService.byToken(created.trackingToken());
        assertThat(byLink.orderCode()).isEqualTo(created.orderCode());

        assertThatThrownBy(() -> trackingService.lookup(created.orderCode(), "0909999999"))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void orderCreatedBeforeTrackingGetsOneStableToken() {
        OrderResponse created = orderService.createForGuest(new GuestOrderCreateRequest(
                "Khách cũ", "0912345678", "45 Lê Lợi", "Phường Chợ Quán", null,
                List.of(new OrderItemRequest(productId, 1)), null));
        orderId = created.id();
        jdbc.update("UPDATE orders SET tracking_token = NULL WHERE id = ?", orderId);

        String first = trackingService.lookup(created.orderCode(), "0912345678").trackingToken();
        String second = trackingService.lookup(created.orderCode(), "0912345678").trackingToken();

        assertThat(first).isNotBlank().isEqualTo(second);
        assertThat(jdbc.queryForObject("SELECT tracking_token FROM orders WHERE id = ?", String.class, orderId))
                .isEqualTo(first);
    }
}
