package com.aquaflow.delivery;

import com.aquaflow.delivery.api.DeliveryDtos.*;
import com.aquaflow.delivery.application.DeliveryService;
import com.aquaflow.shared.api.ConflictException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import com.aquaflow.auth.domain.User;
import com.aquaflow.auth.security.AuthUserDetails;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import java.util.List;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Run against a disposable PostgreSQL instance; test transactions roll back. */
@SpringBootTest(properties = "app.jwt.secret=test-test-test-test-test-test-test-test")
@EnabledIfEnvironmentVariable(named = "DB_URL", matches = ".+")
@Transactional
@AutoConfigureMockMvc
class DeliveryPostgresIntegrationTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired DeliveryService service;
    @Autowired MockMvc mvc;

    long ownerId;
    long driverId;
    long otherDriverId;
    long orderId;

    @BeforeEach
    void prepare() {
        String id = UUID.randomUUID().toString();
        jdbc.update("INSERT INTO roles(code, name) VALUES ('ADMIN','Owner') ON CONFLICT (code) DO NOTHING");
        jdbc.update("INSERT INTO roles(code, name) VALUES ('DELIVERY_STAFF','Driver') ON CONFLICT (code) DO NOTHING");
        ownerId = user("ADMIN", id + "-owner@delivery.test");
        driverId = user("DELIVERY_STAFF", id + "-driver@delivery.test");
        otherDriverId = user("DELIVERY_STAFF", id + "-other@delivery.test");
        long productId = jdbc.queryForObject("""
                INSERT INTO products(sku, name, unit, sale_price) VALUES (?, 'Test water', 'binh', 15000)
                RETURNING id
                """, Long.class, id);
        long batchId = jdbc.queryForObject("""
                INSERT INTO product_batches(product_id, lot_code, expires_on)
                VALUES (?, ?, ?) RETURNING id
                """, Long.class, productId, id, LocalDate.now().plusDays(90));
        orderId = jdbc.queryForObject("""
                INSERT INTO orders(order_code, channel, fulfillment_type, status, created_by,
                                   recipient_name, delivery_address)
                VALUES (?, 'PHONE', 'DELIVERY', 'OUT_FOR_DELIVERY', ?, 'Nguyen A', '1 Test St')
                RETURNING id
                """, Long.class, id, ownerId);
        long itemId = jdbc.queryForObject("""
                INSERT INTO order_items(order_id, product_id, quantity, unit_price, line_total)
                VALUES (?, ?, 2, 15000, 30000) RETURNING id
                """, Long.class, orderId, productId);
        long dispatchId = jdbc.queryForObject("""
                INSERT INTO order_dispatches(order_id, performed_by, order_status)
                VALUES (?, ?, 'OUT_FOR_DELIVERY') RETURNING id
                """, Long.class, orderId, ownerId);
        jdbc.update("""
                INSERT INTO order_dispatch_items(dispatch_id, order_item_id, product_id, batch_id,
                                                 lot_code, expires_on, quantity)
                VALUES (?, ?, ?, ?, ?, ?, 2)
                """, dispatchId, itemId, productId, batchId, id, LocalDate.now().plusDays(90));
    }

    private long user(String role, String email) {
        return jdbc.queryForObject("""
                INSERT INTO users(role_id, full_name, email, password_hash)
                VALUES ((SELECT id FROM roles WHERE code = ?), 'Delivery test', ?, 'unused') RETURNING id
                """, Long.class, role, email);
    }

    private org.springframework.test.web.servlet.request.RequestPostProcessor actor(long id, String role) {
        User user = mock(User.class);
        when(user.getId()).thenReturn(id);
        return authentication(new UsernamePasswordAuthenticationToken(new AuthUserDetails(user), null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role))));
    }

    @Test
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void concurrentTripsCannotClaimTheSameOrder() throws Exception {
        long firstTrip = service.create(new CreateTripRequest(driverId, null), ownerId, true).id();
        long secondTrip = service.create(new CreateTripRequest(otherDriverId, null), ownerId, true).id();
        long productId = jdbc.queryForObject("SELECT product_id FROM order_items WHERE order_id = ?", Long.class, orderId);
        try (var pool = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var start = new java.util.concurrent.CountDownLatch(1);
            java.util.function.LongFunction<java.util.concurrent.Callable<Boolean>> attempt = trip -> () -> {
                start.await();
                try { service.addOrder(trip, new AddOrderRequest(orderId), ownerId, true); return true; }
                catch (ConflictException error) { return false; }
            };
            var first = pool.submit(attempt.apply(firstTrip));
            var second = pool.submit(attempt.apply(secondTrip));
            start.countDown();
            assertThat(List.of(first.get(15, java.util.concurrent.TimeUnit.SECONDS), second.get(15, java.util.concurrent.TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder(true, false);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM delivery_assignments WHERE order_id = ? AND active", Long.class, orderId)).isEqualTo(1);
        } finally {
            jdbc.update("DELETE FROM delivery_assignments WHERE trip_id IN (?, ?)", firstTrip, secondTrip);
            jdbc.update("DELETE FROM delivery_trips WHERE id IN (?, ?)", firstTrip, secondTrip);
            jdbc.update("DELETE FROM order_dispatch_items WHERE dispatch_id IN (SELECT id FROM order_dispatches WHERE order_id = ?)", orderId);
            jdbc.update("DELETE FROM order_dispatches WHERE order_id = ?", orderId);
            jdbc.update("DELETE FROM order_items WHERE order_id = ?", orderId);
            jdbc.update("DELETE FROM orders WHERE id = ?", orderId);
            jdbc.update("DELETE FROM product_batches WHERE product_id = ?", productId);
            jdbc.update("DELETE FROM products WHERE id = ?", productId);
            jdbc.update("DELETE FROM users WHERE id IN (?, ?, ?)", ownerId, driverId, otherDriverId);
        }
    }

    @Test
    void restResourcesEnforceRolesAndExposeOnlyOwnDriverTrips() throws Exception {
        String base = "/api/v1/delivery/trips";
        mvc.perform(get(base)).andExpect(status().isUnauthorized());
        mvc.perform(post(base).with(actor(driverId, "DELIVERY_STAFF")).contentType("application/json").content("{}"))
                .andExpect(status().isForbidden());
        mvc.perform(post(base).with(actor(ownerId, "SALES_STAFF")).contentType("application/json").content("{}"))
                .andExpect(status().isForbidden());
        mvc.perform(post(base).with(actor(ownerId, "ADMIN")).contentType("application/json").content("{}"))
                .andExpect(status().isCreated()).andExpect(header().exists("Location"));
        long trip = service.create(new CreateTripRequest(driverId, null), ownerId, true).id();
        mvc.perform(get(base + "/" + trip).with(actor(otherDriverId, "DELIVERY_STAFF"))).andExpect(status().isForbidden());
        mvc.perform(get(base + "/" + trip).with(actor(ownerId, "SALES_STAFF"))).andExpect(status().isOk());
        mvc.perform(get("/api/v1/delivery/drivers").with(actor(driverId, "DELIVERY_STAFF"))).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/delivery/drivers").with(actor(ownerId, "ADMIN"))).andExpect(status().isOk());
        mvc.perform(get("/api/v1/delivery/available-orders").with(actor(ownerId, "ADMIN"))).andExpect(status().isOk());
        mvc.perform(post(base + "/" + trip + "/orders").with(actor(ownerId, "ADMIN"))
                .contentType("application/json").content("{\"orderId\":" + orderId + "}"))
                .andExpect(status().isCreated()).andExpect(header().string("Location", base + "/" + trip + "/orders/" + orderId));
        mvc.perform(put(base + "/" + trip + "/departure").with(actor(driverId, "DELIVERY_STAFF")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("IN_PROGRESS"));
        mvc.perform(post(base + "/" + trip + "/orders/" + orderId + "/attempts").with(actor(driverId, "DELIVERY_STAFF"))
                .contentType("application/json").content("{\"outcome\":\"FAILED\"}"))
                .andExpect(status().isBadRequest());
        var response = mvc.perform(post(base + "/" + trip + "/orders/" + orderId + "/attempts").with(actor(driverId, "DELIVERY_STAFF"))
                .contentType("application/json").content("{\"outcome\":\"SUCCESS\",\"recipientName\":\"Nguyen A\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse();
        mvc.perform(get(response.getHeader("Location")).with(actor(driverId, "DELIVERY_STAFF")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.outcome").value("SUCCESS"));
        mvc.perform(get(response.getHeader("Location")).with(actor(otherDriverId, "DELIVERY_STAFF"))).andExpect(status().isForbidden());
        mvc.perform(put(base + "/" + trip + "/settlement").with(actor(ownerId, "ADMIN"))
                .contentType("application/json").content("{\"cashReported\":-1,\"cashConfirmed\":0,\"bottlesExpected\":0,\"bottlesConfirmed\":0}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void cancelledTripReleasesOrderWithoutChangingStockAndKeepsHistory() {
        long trip = service.create(new CreateTripRequest(driverId, null), ownerId, true).id();
        service.addOrder(trip, new AddOrderRequest(orderId), ownerId, true);
        assertThat(service.availableOrders(true)).noneMatch(o -> o.id() == orderId);
        assertThat(service.cancel(trip, ownerId, true).orders()).hasSize(1);
        assertThat(service.availableOrders(true)).anyMatch(o -> o.id() == orderId);
        long replacement = service.create(new CreateTripRequest(otherDriverId, null), ownerId, true).id();
        assertThat(service.addOrder(replacement, new AddOrderRequest(orderId), ownerId, true).orders()).hasSize(1);
    }

    @Test
    void failedDeliveryCanMoveToNewTripAfterHandoverAndHistoryRemainsVisible() {
        long trip = service.create(new CreateTripRequest(driverId, null), ownerId, true).id();
        service.addOrder(trip, new AddOrderRequest(orderId), ownerId, true);
        service.start(trip, driverId, false);
        service.start(trip, driverId, false);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM delivery_load_items WHERE assignment_id IN (SELECT id FROM delivery_assignments WHERE trip_id = ?)", Long.class, trip)).isEqualTo(1);
        service.recordResult(trip, orderId, new DeliveryResultRequest(Outcome.FAILED, null, "Vắng nhà", null), driverId, false);
        service.settle(trip, new SettleTripRequest(BigDecimal.ZERO, BigDecimal.ZERO, 0, 0, null), ownerId, true);
        assertThat(service.get(trip, ownerId, true).orders()).hasSize(1);
        assertThat(service.availableOrders(true)).anyMatch(o -> o.id() == orderId && o.deliveryFailed());
        long replacement = service.create(new CreateTripRequest(otherDriverId, null), ownerId, true).id();
        service.addOrder(replacement, new AddOrderRequest(orderId), ownerId, true);
        service.start(replacement, otherDriverId, false);
        service.recordResult(replacement, orderId, new DeliveryResultRequest(Outcome.SUCCESS, "Khách", null, null), otherDriverId, false);
        assertThat(service.get(trip, ownerId, true).orders().getFirst().latestAttempt().outcome()).isEqualTo(Outcome.FAILED);
        assertThat(service.availableOrders(true)).noneMatch(o -> o.id() == orderId);
    }

    @Test
    void incompleteTripAndUnexplainedHandoverMismatchAreRejected() {
        long trip = service.create(new CreateTripRequest(driverId, null), ownerId, true).id();
        assertThatThrownBy(() -> service.start(trip, driverId, false)).isInstanceOf(ConflictException.class);
        service.addOrder(trip, new AddOrderRequest(orderId), ownerId, true);
        service.start(trip, driverId, false);
        assertThatThrownBy(() -> service.cancel(trip, ownerId, true)).isInstanceOf(ConflictException.class);
        assertThatThrownBy(() -> service.settle(trip, new SettleTripRequest(BigDecimal.ZERO, BigDecimal.ZERO, 0, 0, null), ownerId, true))
                .isInstanceOf(ConflictException.class);
        service.recordResult(trip, orderId, new DeliveryResultRequest(Outcome.SUCCESS, "Khách", null, null), driverId, false);
        assertThatThrownBy(() -> service.settle(trip, new SettleTripRequest(BigDecimal.TEN, BigDecimal.ZERO, 0, 0, null), ownerId, true))
                .isInstanceOf(com.aquaflow.shared.api.BadRequestException.class);
    }

    @Test
    void deliveryFlowDoesNotDoubleDispatchOrMarkPayment() {
        long tripId = service.create(new CreateTripRequest(null, "59A-12345"), ownerId, true).id();
        service.assignDriver(tripId, new AssignDriverRequest(driverId), ownerId, true);
        service.addOrder(tripId, new AddOrderRequest(orderId), ownerId, true);
        assertThatThrownBy(() -> service.recordResult(tripId, orderId,
                new DeliveryResultRequest(Outcome.SUCCESS, "Nguoi nhan", null, null), driverId, false))
                .isInstanceOf(ConflictException.class);

        var started = service.start(tripId, driverId, false);
        assertThat(started.status()).isEqualTo("IN_PROGRESS");
        assertThat(jdbc.queryForObject("SELECT SUM(quantity_loaded) FROM delivery_load_items WHERE assignment_id = ?",
                Long.class, started.orders().getFirst().id())).isEqualTo(2L);

        service.recordResult(tripId, orderId,
                new DeliveryResultRequest(Outcome.FAILED, null, "Khach vang nha", null), driverId, false);
        assertThat(jdbc.queryForObject("SELECT delivery_failed FROM orders WHERE id = ?", Boolean.class, orderId)).isTrue();
        assertThat(jdbc.queryForObject("SELECT status FROM orders WHERE id = ?", String.class, orderId))
                .isEqualTo("OUT_FOR_DELIVERY");

        service.recordResult(tripId, orderId,
                new DeliveryResultRequest(Outcome.SUCCESS, "Nguoi nhan", null, "Giao lai thanh cong"), driverId, false);
        assertThat(jdbc.queryForObject("SELECT status FROM orders WHERE id = ?", String.class, orderId))
                .isEqualTo("DELIVERED");
        assertThat(jdbc.queryForObject("SELECT payment_status FROM orders WHERE id = ?", String.class, orderId))
                .isEqualTo("UNPAID");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM inventory_movements WHERE reference_type = 'ORDER' AND reference_id = ?",
                Long.class, orderId)).isZero();

        var completed = service.settle(tripId,
                new SettleTripRequest(BigDecimal.ZERO, BigDecimal.ZERO, 0, 0, "Da doi soat"), ownerId, true);
        assertThat(completed.status()).isEqualTo("COMPLETED");
        assertThat(completed.settlement()).isNotNull();
        assertThatThrownBy(() -> service.settle(tripId,
                new SettleTripRequest(BigDecimal.ZERO, BigDecimal.ZERO, 0, 0, null), ownerId, true))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    void driversCannotViewOthersTripsAndOrderCannotBeOnTwoTrips() {
        long tripId = service.create(new CreateTripRequest(driverId, null), ownerId, true).id();
        service.addOrder(tripId, new AddOrderRequest(orderId), ownerId, true);
        assertThatThrownBy(() -> service.get(tripId, otherDriverId, false))
                .isInstanceOf(AccessDeniedException.class);
        long otherTrip = service.create(new CreateTripRequest(otherDriverId, null), ownerId, true).id();
        assertThatThrownBy(() -> service.addOrder(otherTrip, new AddOrderRequest(orderId), ownerId, true))
                .isInstanceOf(ConflictException.class);
        service.removeOrder(tripId, orderId, ownerId, true);
        assertThat(service.addOrder(otherTrip, new AddOrderRequest(orderId), ownerId, true).orders())
                .hasSize(1);
    }
}
