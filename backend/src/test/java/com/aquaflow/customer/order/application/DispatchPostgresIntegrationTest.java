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
    @Autowired com.aquaflow.delivery.application.DeliveryService delivery;
    @Autowired MockMvc mvc;
    @Autowired com.aquaflow.inventory.application.InventoryMovementService movementHistory;
    Long productId;
    Long orderId;
    Long secondOrderId;
    Long actorId;
    Long driverId;

    @BeforeEach
    void setup() {
        String suffix = UUID.randomUUID().toString();
        jdbc.update("INSERT INTO roles (code, name) VALUES ('SALES_STAFF', 'Sales') ON CONFLICT (code) DO NOTHING");
        jdbc.update("INSERT INTO roles (code, name) VALUES ('DELIVERY_STAFF', 'Driver') ON CONFLICT (code) DO NOTHING");
        actorId = jdbc.queryForObject("""
                INSERT INTO users (role_id, full_name, email, password_hash)
                VALUES ((SELECT id FROM roles WHERE code = 'SALES_STAFF'), 'Dispatch test', ?, 'unused') RETURNING id
                """, Long.class, suffix + "@dispatch.test");
        driverId = jdbc.queryForObject("""
                INSERT INTO users (role_id, full_name, email, password_hash)
                VALUES ((SELECT id FROM roles WHERE code = 'DELIVERY_STAFF'), 'Dispatch driver', ?, 'unused') RETURNING id
                """, Long.class, suffix + "@driver.dispatch.test");
        productId = jdbc.queryForObject("INSERT INTO products (sku, name, unit, sale_price) VALUES (?, 'Dispatch', 'binh', 20) RETURNING id",
                Long.class, suffix);
        orderId = jdbc.queryForObject("INSERT INTO orders (order_code, channel, fulfillment_type) VALUES (?, 'PHONE', 'DELIVERY') RETURNING id",
                Long.class, suffix);
        jdbc.update("INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total) VALUES (?, ?, 5, 20, 100)", orderId, productId);
    }

    @AfterEach
    void cleanup() {
        cleanupOrder(orderId);
        if (secondOrderId != null) cleanupOrder(secondOrderId);
        jdbc.update("DELETE FROM delivery_trips WHERE created_by = ?", actorId);
        jdbc.update("DELETE FROM inventory_balances WHERE batch_id IN (SELECT id FROM product_batches WHERE product_id = ?)", productId);
        jdbc.update("DELETE FROM product_batches WHERE product_id = ?", productId);
        jdbc.update("DELETE FROM products WHERE id = ?", productId);
        jdbc.update("DELETE FROM users WHERE id = ?", actorId);
        jdbc.update("DELETE FROM users WHERE id = ?", driverId);
    }

    private void cleanupOrder(Long cleanupOrderId) {
        jdbc.update("DELETE FROM audit_logs WHERE actor_id=? OR (entity_type='ORDER' AND entity_id=?) OR (entity_type='DISPATCH' AND entity_id IN (SELECT id FROM order_dispatches WHERE order_id=?))", actorId, cleanupOrderId, cleanupOrderId);
        jdbc.update("DELETE FROM delivery_attempts WHERE assignment_id IN (SELECT id FROM delivery_assignments WHERE order_id = ?)", cleanupOrderId);
        jdbc.update("DELETE FROM delivery_load_items WHERE assignment_id IN (SELECT id FROM delivery_assignments WHERE order_id = ?)", cleanupOrderId);
        jdbc.update("DELETE FROM delivery_assignments WHERE order_id = ?", cleanupOrderId);
        jdbc.update("DELETE FROM order_dispatch_items WHERE dispatch_id IN (SELECT id FROM order_dispatches WHERE order_id = ?)", cleanupOrderId);
        jdbc.update("DELETE FROM order_dispatches WHERE order_id = ?", cleanupOrderId);
        jdbc.update("DELETE FROM inventory_movements WHERE reference_type = 'ORDER' AND reference_id = ?", cleanupOrderId);
        jdbc.update("DELETE FROM stock_reservations WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = ?)", cleanupOrderId);
        jdbc.update("DELETE FROM order_items WHERE order_id = ?", cleanupOrderId);
        jdbc.update("DELETE FROM orders WHERE id = ?", cleanupOrderId);
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

    Long assignToTrip() {
        long tripId = delivery.create(new com.aquaflow.delivery.api.DeliveryDtos.CreateTripRequest(driverId, null), actorId, true).id();
        delivery.addOrder(tripId, new com.aquaflow.delivery.api.DeliveryDtos.AddOrderRequest(orderId), actorId, true);
        return tripId;
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
        assignToTrip();
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
    void counterDispatchHandsOverGoodsWithoutMarkingPaidOrCompleted() {
        jdbc.update("UPDATE orders SET fulfillment_type = 'COUNTER' WHERE id = ?", orderId);
        batch("COUNTER", 20, 5);
        prepare();
        assertThat(dispatches.create(orderId, actorId).orderStatus()).isEqualTo(OrderStatus.DELIVERED);
        assertThat(orders.findById(orderId).orElseThrow().paymentStatus().name()).isEqualTo("UNPAID");
        assertThat(jdbc.queryForObject("SELECT movement_type FROM inventory_movements WHERE reference_id = ? AND reference_type = 'ORDER'", String.class, orderId))
                .isEqualTo("COUNTER_SALE");
    }

    @Test
    void onlyOneOfTwoConcurrentDispatchesSucceeds() throws Exception {
        batch("RACE", 20, 10);
        prepare();
        assignToTrip();
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
        assignToTrip();
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
        assignToTrip();
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
        assignToTrip();
        jdbc.update("UPDATE product_batches SET expires_on = ? WHERE id = ?", LocalDate.now(), lot);
        assertThatThrownBy(() -> dispatches.create(orderId, actorId)).isInstanceOf(ConflictException.class).hasMessageContaining("hết hạn");
        assertUnchanged();
    }

    @Test
    void incompleteReservationCannotBeDispatched() {
        batch("MISSING", 10, 5);
        prepare();
        assignToTrip();
        jdbc.update("UPDATE stock_reservations SET quantity_released = 1 WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = ?)", orderId);
        assertThatThrownBy(() -> dispatches.create(orderId, actorId)).isInstanceOf(ConflictException.class);
        assertUnchanged();
    }

    @Test
    void deliveryDispatchRequiresAnActiveAssignment() throws Exception {
        batch("NO-TRIP", 10, 5);
        prepare();

        assertThatThrownBy(() -> dispatches.create(orderId, actorId)).isInstanceOf(ConflictException.class);
        mvc.perform(post(url()).with(staff())).andExpect(status().isConflict());
        assertUnchanged();
    }

    @Test
    void deliveryDispatchRejectsAnInactiveAssignment() throws Exception {
        batch("INACTIVE", 10, 5);
        prepare();
        long tripId = assignToTrip();
        delivery.cancel(tripId, actorId, true);

        assertThatThrownBy(() -> dispatches.create(orderId, actorId)).isInstanceOf(ConflictException.class);
        mvc.perform(post(url()).with(staff())).andExpect(status().isConflict());
        assertUnchanged();
    }

    @Test
    void deliveryDispatchRejectsInactiveAssignmentWhileTripIsCreated() throws Exception {
        batch("INACTIVE-ASSIGNMENT", 10, 5);
        prepare();
        long tripId = assignToTrip();
        jdbc.update("UPDATE delivery_assignments SET active = FALSE WHERE trip_id = ? AND order_id = ?", tripId, orderId);

        assertThatThrownBy(() -> delivery.dispatchAssignment(tripId, orderId, actorId, true))
                .isInstanceOf(ConflictException.class);
        mvc.perform(post(url()).with(staff())).andExpect(status().isConflict());
        assertUnchanged();
    }

    @Test
    void deliveryDispatchRejectsATripWithoutAnActiveDriver() throws Exception {
        batch("NO-DRIVER", 10, 5);
        prepare();
        long tripId = delivery.create(new com.aquaflow.delivery.api.DeliveryDtos.CreateTripRequest(null, null), actorId, true).id();
        delivery.addOrder(tripId, new com.aquaflow.delivery.api.DeliveryDtos.AddOrderRequest(orderId), actorId, true);

        assertThatThrownBy(() -> dispatches.create(orderId, actorId)).isInstanceOf(ConflictException.class);
        mvc.perform(post(url()).with(staff())).andExpect(status().isConflict());
        assertUnchanged();
    }

    @Test
    void deliveryDispatchRejectsDriverThatBecomesInactive() {
        batch("INACTIVE-DRIVER", 10, 5);
        prepare();
        long tripId = assignToTrip();
        jdbc.update("UPDATE users SET status = 'INACTIVE' WHERE id = ?", driverId);

        assertThatThrownBy(() -> delivery.dispatchAssignment(tripId, orderId, actorId, true))
                .isInstanceOf(com.aquaflow.shared.api.BadRequestException.class);
        assertUnchanged();
    }

    @Test
    void deliveryDispatchRejectsDriverWithoutDeliveryRole() {
        batch("WRONG-ROLE-DRIVER", 10, 5);
        prepare();
        long tripId = assignToTrip();
        jdbc.update("INSERT INTO roles (code, name) VALUES ('WAREHOUSE_STAFF', 'Warehouse') ON CONFLICT (code) DO NOTHING");
        jdbc.update("UPDATE users SET role_id = (SELECT id FROM roles WHERE code = 'WAREHOUSE_STAFF') WHERE id = ?", driverId);

        assertThatThrownBy(() -> delivery.dispatchAssignment(tripId, orderId, actorId, true))
                .isInstanceOf(com.aquaflow.shared.api.BadRequestException.class);
        assertUnchanged();
    }

    @Test
    void deliveryAssignmentOnStartedTripCannotDispatch() {
        batch("STARTED-TRIP", 10, 5);
        prepare();
        long tripId = assignToTrip();
        jdbc.update("UPDATE delivery_trips SET status = 'IN_PROGRESS' WHERE id = ?", tripId);

        assertThatThrownBy(() -> delivery.dispatchAssignment(tripId, orderId, actorId, true))
                .isInstanceOf(ConflictException.class);
        assertUnchanged();
    }

    @Test
    void cannotDispatchAnAssignmentThroughAnotherTrip() {
        batch("WRONG-TRIP", 10, 5);
        prepare();
        long targetTripId = delivery.create(
                new com.aquaflow.delivery.api.DeliveryDtos.CreateTripRequest(driverId, null), actorId, true).id();
        assignToTrip();

        assertThatThrownBy(() -> delivery.dispatchAssignment(targetTripId, orderId, actorId, true))
                .isInstanceOf(ConflictException.class);
        assertUnchanged();
    }

    @Test
    void assignmentsInOneTripCanBeDispatchedIndependently() throws Exception {
        batch("TWO-ASSIGNMENTS", 20, 10);
        prepare();
        secondOrderId = jdbc.queryForObject("INSERT INTO orders (order_code, channel, fulfillment_type) VALUES (?, 'PHONE', 'DELIVERY') RETURNING id",
                Long.class, UUID.randomUUID().toString());
        jdbc.update("INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total) VALUES (?, ?, 5, 20, 100)",
                secondOrderId, productId);
        orders.transitionStatus(secondOrderId, OrderStatus.CONFIRMED);
        orders.transitionStatus(secondOrderId, OrderStatus.PREPARING);
        long tripId = assignToTrip();
        delivery.addOrder(tripId, new com.aquaflow.delivery.api.DeliveryDtos.AddOrderRequest(secondOrderId), actorId, true);

        String firstAssignmentDispatch = "/api/v1/delivery/trips/" + tripId + "/orders/" + orderId + "/dispatch";
        mvc.perform(post(firstAssignmentDispatch)).andExpect(status().isUnauthorized());
        mvc.perform(post(firstAssignmentDispatch).with(user("driver").roles("DELIVERY_STAFF")))
                .andExpect(status().isForbidden());
        mvc.perform(post(firstAssignmentDispatch).with(user("customer").roles("CUSTOMER")))
                .andExpect(status().isForbidden());
        mvc.perform(post(firstAssignmentDispatch).with(staff())).andExpect(status().isCreated())
                .andExpect(jsonPath("$.orderStatus").value("OUT_FOR_DELIVERY"));
        assertThatThrownBy(() -> delivery.dispatchAssignment(tripId, orderId, actorId, true))
                .isInstanceOf(ConflictException.class);
        mvc.perform(post("/api/v1/delivery/trips/" + tripId + "/orders/" + secondOrderId + "/dispatch").with(staff()))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.orderStatus").value("OUT_FOR_DELIVERY"));

        assertThat(dispatches.list(orderId)).hasSize(1);
        assertThat(dispatches.list(secondOrderId)).hasSize(1);
        assertThat(jdbc.queryForObject("SELECT on_hand FROM inventory_balances WHERE batch_id IN (SELECT id FROM product_batches WHERE product_id = ?)",
                Integer.class, productId)).isZero();
        assertThat(jdbc.queryForObject("SELECT SUM(quantity) FROM inventory_movements WHERE movement_type='DISPATCH' AND reference_type='ORDER' AND reference_id IN (?, ?)",
                Integer.class, orderId, secondOrderId)).isEqualTo(10);
    }

    @Test
    void bulkTripDispatchKeepsEarlierAssignmentWhenLaterAssignmentFails() {
        batch("INDEPENDENT-FAILURE", 20, 10);
        prepare();
        secondOrderId = jdbc.queryForObject("INSERT INTO orders (order_code, channel, fulfillment_type) VALUES (?, 'PHONE', 'DELIVERY') RETURNING id",
                Long.class, UUID.randomUUID().toString());
        jdbc.update("INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total) VALUES (?, ?, 5, 20, 100)",
                secondOrderId, productId);
        orders.transitionStatus(secondOrderId, OrderStatus.CONFIRMED);
        orders.transitionStatus(secondOrderId, OrderStatus.PREPARING);
        long tripId = assignToTrip();
        delivery.addOrder(tripId, new com.aquaflow.delivery.api.DeliveryDtos.AddOrderRequest(secondOrderId), actorId, true);

        assertThat(delivery.dispatchAssignment(tripId, orderId, actorId, true).orderStatus()).isEqualTo(OrderStatus.OUT_FOR_DELIVERY);
        jdbc.update("UPDATE inventory_balances SET reserved = 0 WHERE batch_id IN (SELECT id FROM product_batches WHERE product_id = ?)", productId);

        assertThatThrownBy(() -> delivery.dispatch(tripId, actorId, true)).isInstanceOf(ConflictException.class);
        assertThat(jdbc.queryForObject("SELECT status FROM orders WHERE id = ?", String.class, orderId)).isEqualTo("OUT_FOR_DELIVERY");
        assertThat(dispatches.list(orderId)).hasSize(1);
        assertThat(jdbc.queryForObject("SELECT status FROM orders WHERE id = ?", String.class, secondOrderId)).isEqualTo("PREPARING");
        assertThat(dispatches.list(secondOrderId)).isEmpty();
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
