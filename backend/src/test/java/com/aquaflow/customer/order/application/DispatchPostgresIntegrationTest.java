package com.aquaflow.customer.order.application;

import com.aquaflow.auth.domain.User;
import com.aquaflow.auth.security.AuthUserDetails;
import com.aquaflow.customer.order.domain.OrderStatus;
import com.aquaflow.shared.api.ConflictException;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "app.jwt.secret=test-test-test-test-test-test-test-test")
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named = "DB_URL", matches = ".+")
class DispatchPostgresIntegrationTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired OrderService orders;
    @Autowired OrderDispatchService dispatches;
    @Autowired MockMvc mvc;
    @Autowired com.aquaflow.inventory.application.InventoryMovementService movementHistory;
    Long productId;
    Long orderId;
    Long actorId;

    @BeforeEach
    void setup() {
        String suffix = UUID.randomUUID().toString();
        jdbc.update("INSERT INTO roles (code, name) VALUES ('SALES_STAFF', 'Sales') ON CONFLICT (code) DO NOTHING");
        actorId = jdbc.queryForObject("""
                INSERT INTO users (role_id, full_name, email, password_hash)
                VALUES ((SELECT id FROM roles WHERE code = 'SALES_STAFF'), 'Dispatch test', ?, 'unused') RETURNING id
                """, Long.class, suffix + "@dispatch.test");
        productId = jdbc.queryForObject("INSERT INTO products (sku, name, unit, sale_price) VALUES (?, 'Dispatch', 'binh', 20) RETURNING id",
                Long.class, suffix);
        orderId = jdbc.queryForObject("INSERT INTO orders (order_code, channel, fulfillment_type) VALUES (?, 'PHONE', 'DELIVERY') RETURNING id",
                Long.class, suffix);
        jdbc.update("INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total) VALUES (?, ?, 5, 20, 100)", orderId, productId);
    }

    @AfterEach
    void cleanup() {
        jdbc.update("DELETE FROM audit_logs WHERE actor_id=? OR (entity_type='ORDER' AND entity_id=?) OR (entity_type='DISPATCH' AND entity_id IN (SELECT id FROM order_dispatches WHERE order_id=?))", actorId, orderId, orderId);
        jdbc.update("DELETE FROM order_dispatch_items WHERE dispatch_id IN (SELECT id FROM order_dispatches WHERE order_id = ?)", orderId);
        jdbc.update("DELETE FROM order_dispatches WHERE order_id = ?", orderId);
        jdbc.update("DELETE FROM inventory_movements WHERE reference_type = 'ORDER' AND reference_id = ?", orderId);
        jdbc.update("DELETE FROM stock_reservations WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = ?)", orderId);
        jdbc.update("DELETE FROM order_items WHERE order_id = ?", orderId);
        jdbc.update("DELETE FROM orders WHERE id = ?", orderId);
        jdbc.update("DELETE FROM inventory_balances WHERE batch_id IN (SELECT id FROM product_batches WHERE product_id = ?)", productId);
        jdbc.update("DELETE FROM product_batches WHERE product_id = ?", productId);
        jdbc.update("DELETE FROM products WHERE id = ?", productId);
        jdbc.update("DELETE FROM users WHERE id = ?", actorId);
    }

    Long batch(String lot, int days, int quantity) {
        Long id = jdbc.queryForObject("INSERT INTO product_batches (product_id, lot_code, expires_on) VALUES (?, ?, ?) RETURNING id",
                Long.class, productId, lot, LocalDate.now().plusDays(days));
        jdbc.update("INSERT INTO inventory_balances (batch_id, on_hand) VALUES (?, ?)", id, quantity);
        return id;
    }

    void prepare() {
        orders.transitionStatus(orderId, OrderStatus.CONFIRMED);
        orders.transitionStatus(orderId, OrderStatus.PREPARING);
    }

    String url() { return "/api/v1/sales/orders/" + orderId + "/dispatches"; }

    org.springframework.test.web.servlet.request.RequestPostProcessor staff() {
        User user = mock(User.class);
        when(user.getId()).thenReturn(actorId);
        return authentication(new UsernamePasswordAuthenticationToken(new AuthUserDetails(user), null,
                List.of(new SimpleGrantedAuthority("ROLE_SALES_STAFF"))));
    }

    void assertUnchanged() {
        assertThat(jdbc.queryForObject("SELECT status FROM orders WHERE id = ?", String.class, orderId)).isEqualTo("PREPARING");
        assertThat(dispatches.list(orderId)).isEmpty();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM inventory_movements WHERE reference_type = 'ORDER' AND reference_id = ?",
                Long.class, orderId)).isZero();
        assertThat(jdbc.queryForObject("SELECT sum(quantity_dispatched) FROM stock_reservations WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = ?)",
                Integer.class, orderId)).isZero();
    }

    @Test
    void restCreatesReceiptAcrossFefoLotsAndReadOnlyResourcesAreScopedToOrder() throws Exception {
        batch("SOON", 10, 3);
        batch("LATER", 30, 5);
        prepare();
        mvc.perform(post(url()).with(staff())).andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andExpect(jsonPath("$.orderStatus").value("OUT_FOR_DELIVERY"))
                .andExpect(jsonPath("$.performedBy").value(actorId))
                .andExpect(jsonPath("$.items[0].quantity").value(3))
                .andExpect(jsonPath("$.items[1].quantity").value(2));
        var receipt = dispatches.list(orderId).getFirst();

        var history = movementHistory.list(com.aquaflow.inventory.domain.MovementType.DISPATCH, productId,
                null, null, null, 0, 20);
        assertThat(history.content()).hasSize(2);
        assertThat(history.content()).allMatch(m -> m.referenceId().equals(orderId));
        assertThat(history.content().stream().mapToInt(m -> m.signedQuantity()).sum()).isEqualTo(-5);

        mvc.perform(get(url() + "/" + receipt.id()).with(user("sales").roles("SALES_STAFF")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(receipt.id()));
        mvc.perform(get("/api/v1/sales/orders/0/dispatches/" + receipt.id()).with(user("sales").roles("SALES_STAFF")))
                .andExpect(status().isNotFound());
        mvc.perform(post(url()).with(staff())).andExpect(status().isConflict());
        assertThat(jdbc.queryForObject("SELECT sum(on_hand) FROM inventory_balances WHERE batch_id IN (SELECT id FROM product_batches WHERE product_id = ?)",
                Integer.class, productId)).isEqualTo(3);
        assertThat(jdbc.queryForObject("SELECT sum(reserved) FROM inventory_balances WHERE batch_id IN (SELECT id FROM product_batches WHERE product_id = ?)",
                Integer.class, productId)).isZero();
        assertThat(jdbc.queryForObject("SELECT sum(quantity) FROM inventory_movements WHERE reference_type = 'ORDER' AND reference_id = ?", Integer.class, orderId)).isEqualTo(5);
        assertThatThrownBy(() -> orders.transitionStatus(orderId, OrderStatus.CANCELLED)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void counterDispatchIsRejectedWithoutChangingStock() {
        jdbc.update("UPDATE orders SET fulfillment_type = 'COUNTER' WHERE id = ?", orderId);
        batch("COUNTER", 20, 5);
        prepare();
        assertThatThrownBy(() -> dispatches.create(orderId, actorId)).isInstanceOf(com.aquaflow.shared.api.ConflictException.class);
        assertUnchanged();
    }

    @Test
    void onlyOneOfTwoConcurrentDispatchesSucceeds() throws Exception {
        batch("RACE", 20, 10);
        prepare();
        CountDownLatch start = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            Callable<Boolean> task = () -> {
                start.await();
                try { dispatches.create(orderId, actorId); return true; }
                catch (ConflictException e) { return false; }
            };
            var first = pool.submit(task);
            var second = pool.submit(task);
            start.countDown();
            assertThat(List.of(first.get(15, TimeUnit.SECONDS), second.get(15, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder(true, false);
        }
        assertThat(dispatches.list(orderId)).hasSize(1);
        assertThat(jdbc.queryForObject("SELECT sum(on_hand) FROM inventory_balances WHERE batch_id IN (SELECT id FROM product_batches WHERE product_id = ?)", Integer.class, productId)).isEqualTo(5);
    }

    @Test
    void dispatchAndCancellationCannotBothCommit() throws Exception {
        batch("CANCEL-RACE", 20, 10);
        prepare();
        CountDownLatch start = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var exported = pool.submit(() -> {
                start.await();
                try { dispatches.create(orderId, actorId); return true; }
                catch (ConflictException e) { return false; }
            });
            var cancelled = pool.submit(() -> {
                start.await();
                try { orders.transitionStatus(orderId, OrderStatus.CANCELLED); return true; }
                catch (IllegalStateException e) { return false; }
            });
            start.countDown();
            boolean dispatched = exported.get(15, TimeUnit.SECONDS);
            assertThat(cancelled.get(15, TimeUnit.SECONDS)).isEqualTo(!dispatched);
            assertThat(dispatches.list(orderId)).hasSize(dispatched ? 1 : 0);
            assertThat(jdbc.queryForObject("SELECT on_hand FROM inventory_balances WHERE batch_id IN (SELECT id FROM product_batches WHERE product_id = ?)",
                    Integer.class, productId)).isEqualTo(dispatched ? 5 : 10);
        }
    }

    @Test
    void laterBatchFailureRollsBackEarlierDispatchAndOrderStatus() {
        Long first = batch("FIRST", 10, 3);
        Long second = batch("SECOND", 20, 5);
        prepare();
        // Simulate inconsistent inventory after reservation; first lot must roll back as well.
        jdbc.update("UPDATE inventory_balances SET reserved = 0 WHERE batch_id = ?", second);
        assertThatThrownBy(() -> dispatches.create(orderId, actorId)).isInstanceOf(ConflictException.class);
        assertUnchanged();
        assertThat(jdbc.queryForObject("SELECT on_hand FROM inventory_balances WHERE batch_id = ?", Integer.class, first)).isEqualTo(3);
        assertThat(jdbc.queryForObject("SELECT reserved FROM inventory_balances WHERE batch_id = ?", Integer.class, first)).isEqualTo(3);
    }

    @Test
    void expiredReservationCannotBeDispatched() {
        Long lot = batch("EXPIRED", 10, 5);
        prepare();
        jdbc.update("UPDATE product_batches SET expires_on = ? WHERE id = ?", LocalDate.now(), lot);
        assertThatThrownBy(() -> dispatches.create(orderId, actorId)).isInstanceOf(ConflictException.class).hasMessageContaining("hết hạn");
        assertUnchanged();
    }

    @Test
    void incompleteReservationCannotBeDispatched() {
        batch("MISSING", 10, 5);
        prepare();
        jdbc.update("UPDATE stock_reservations SET quantity_released = 1 WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = ?)", orderId);
        assertThatThrownBy(() -> dispatches.create(orderId, actorId)).isInstanceOf(ConflictException.class);
        assertUnchanged();
    }

    @Test
    void resourceEnforcesAuthenticationRolesAndState() throws Exception {
        mvc.perform(post(url())).andExpect(status().isUnauthorized());
        for (String role : List.of("CUSTOMER", "DELIVERY_STAFF")) {
            mvc.perform(post(url()).with(user("denied").roles(role))).andExpect(status().isForbidden());
            mvc.perform(get(url()).with(user("denied").roles(role))).andExpect(status().isForbidden());
        }
        mvc.perform(get(url()).with(user("admin").roles("ADMIN"))).andExpect(status().isOk()).andExpect(content().json("[]"));
        mvc.perform(post(url()).with(staff())).andExpect(status().isConflict());
        mvc.perform(post("/api/v1/sales/orders/0/dispatches").with(staff())).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/sales/orders/0/dispatches").with(user("admin").roles("ADMIN"))).andExpect(status().isNotFound());
        batch("READY", 10, 5);
        prepare();
        mvc.perform(patch("/api/v1/sales/orders/" + orderId + "/status").with(staff())
                        .contentType("application/json").content("{\"status\":\"OUT_FOR_DELIVERY\"}"))
                .andExpect(status().isConflict());
        assertUnchanged();
    }
}
