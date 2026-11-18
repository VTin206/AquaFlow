package com.aquaflow.inventory;

import com.aquaflow.inventory.application.BestSellerService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Câu SQL "Bán chạy" trên PostgreSQL thật: chỉ đơn đã giao trong 30 ngày, chỉ sản phẩm đang bán, xếp theo số lượng.
 * Số lượng rất lớn để đứng đầu bất kể dữ liệu khác có sẵn trong database test.
 */
@SpringBootTest(properties = "app.jwt.secret=test-test-test-test-test-test-test-test")
@EnabledIfEnvironmentVariable(named = "DB_URL", matches = ".+")
class BestSellerPostgresIntegrationTest {

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private BestSellerService service;

    private final List<Long> orders = new ArrayList<>();
    private final List<Long> products = new ArrayList<>();
    private String tag;
    private long actor;

    @BeforeEach
    void setUp() {
        tag = UUID.randomUUID().toString().substring(0, 8);
        jdbc.update("INSERT INTO roles(code,name) VALUES ('ADMIN','Administrator') ON CONFLICT (code) DO NOTHING");
        actor = jdbc.queryForObject("INSERT INTO users(role_id,full_name,email,password_hash) VALUES "
                + "((SELECT id FROM roles WHERE code='ADMIN'),'Best seller tester',?,'unused') RETURNING id", Long.class, tag + "@best.test");
    }

    @AfterEach
    void tearDown() {
        for (Long order : orders) {
            jdbc.update("DELETE FROM order_items WHERE order_id = ?", order);
            jdbc.update("DELETE FROM orders WHERE id = ?", order);
        }
        for (Long product : products) jdbc.update("DELETE FROM products WHERE id = ?", product);
        jdbc.update("DELETE FROM users WHERE id = ?", actor);
    }

    @Test
    void ranksActiveProductsByQuantityDeliveredInTheLast30Days() {
        OffsetDateTime now = OffsetDateTime.now();
        long second = product("second", true);
        long first = product("first", true);
        long inactive = product("inactive", false);
        long old = product("old", true);
        long cancelled = product("cancelled", true);
        long pending = product("pending", true);

        sell(first, 900_000, "DELIVERED", now.minusDays(2));
        sell(second, 500_000, "COMPLETED", now.minusDays(10));
        sell(second, 300_000, "DELIVERED", now.minusDays(1)); // cộng dồn nhiều đơn: 800.000 < 900.000
        sell(inactive, 2_000_000, "DELIVERED", now.minusDays(1)); // ngừng bán
        sell(old, 3_000_000, "DELIVERED", now.minusDays(40)); // ngoài 30 ngày
        sell(cancelled, 4_000_000, "CANCELLED", now.minusDays(1)); // đơn hủy
        sell(pending, 5_000_000, "PENDING", null); // chưa giao

        List<Long> ids = service.productIds();

        assertThat(ids).hasSizeLessThanOrEqualTo(5);
        assertThat(ids).startsWith(first, second);
        assertThat(ids).doesNotContain(inactive, old, cancelled, pending);
    }

    @Test
    void skipsProductsSoldFewerThanThreeUnits() {
        long few = product("few", true);
        sell(few, 2, "DELIVERED", OffsetDateTime.now().minusDays(1));

        assertThat(service.productIds()).doesNotContain(few);
    }

    private long product(String name, boolean active) {
        long id = jdbc.queryForObject("INSERT INTO products (sku, name, unit, sale_price, active) VALUES (?, ?, 'Bình', 20000, ?) RETURNING id",
                Long.class, "BS-" + tag + "-" + name, "Bán chạy " + name + " " + tag, active);
        products.add(id);
        return id;
    }

    private void sell(long product, int quantity, String status, OffsetDateTime deliveredAt) {
        long order = jdbc.queryForObject("""
                        INSERT INTO orders (order_code, created_by, channel, fulfillment_type, status,
                                            recipient_name, recipient_phone, delivery_address, subtotal, delivered_at)
                        VALUES (?, ?, 'COUNTER', 'DELIVERY', ?, 'Khách', '0900000000', '1 Đường A', ?, ?) RETURNING id""",
                Long.class, "BS-" + UUID.randomUUID(), actor, status, 20000L * quantity, deliveredAt);
        orders.add(order);
        jdbc.update("INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total) VALUES (?, ?, ?, 20000, ?)",
                order, product, quantity, 20000L * quantity);
    }
}
