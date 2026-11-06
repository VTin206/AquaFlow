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

@SpringBootTest(properties = "app.jwt.secret=test-test-test-test-test-test-test-test")
@EnabledIfEnvironmentVariable(named = "DB_URL", matches = ".+")
@Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
@AutoConfigureMockMvc
class DeliveryPostgresIntegrationTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired DeliveryService service;
    @Autowired MockMvc mvc;
    @Autowired com.aquaflow.delivery.application.DeliveryAssignmentService assignmentService;

    @Test
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void assignmentRestContractRejectsDuplicateDispatchAndRequiresReturnBeforeRedelivery() throws Exception {
        long trip = service.create(new CreateTripRequest(driverId, null), ownerId, true).id();
        long assignment = service.addOrder(trip, new AddOrderRequest(orderId), ownerId, true).orders().getFirst().id();
        String base = "/api/v1/delivery/assignments/" + assignment;
        mvc.perform(post(base + "/dispatch")).andExpect(status().isUnauthorized());
        mvc.perform(post(base + "/dispatch").with(actor(driverId, "DELIVERY_STAFF"))).andExpect(status().isForbidden());
        mvc.perform(post(base + "/dispatch").with(actor(ownerId, "SALES_STAFF")))
            .andExpect(status().isCreated()).andExpect(header().exists("Location"))
            .andExpect(jsonPath("$.orderStatus").value("OUT_FOR_DELIVERY"));
        mvc.perform(post(base + "/dispatch").with(actor(ownerId, "ADMIN"))).andExpect(status().isConflict());
        service.start(trip, driverId, false);
        mvc.perform(get(base + "/attempts").with(actor(otherDriverId, "DELIVERY_STAFF"))).andExpect(status().isForbidden());
        mvc.perform(post(base + "/attempts").with(actor(driverId, "DELIVERY_STAFF"))
            .contentType("application/json").content("{\"outcome\":\"FAILED\"}")).andExpect(status().isBadRequest());
        mvc.perform(post(base + "/attempts").with(actor(otherDriverId, "DELIVERY_STAFF"))
            .contentType("application/json").content("{\"outcome\":\"FAILED\",\"failureReason\":\"Absent\"}"))
            .andExpect(status().isForbidden());
        mvc.perform(post(base + "/attempts").with(actor(driverId, "DELIVERY_STAFF"))
            .contentType("application/json").content("{\"outcome\":\"FAILED\",\"failureReason\":\"Absent\"}"))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.attemptedAt").isNotEmpty());
        mvc.perform(post(base + "/attempts").with(actor(driverId, "DELIVERY_STAFF"))
            .contentType("application/json").content("{\"outcome\":\"SUCCESS\",\"recipientName\":\"Customer\"}"))
            .andExpect(status().isConflict());
        mvc.perform(get(base + "/attempts").with(actor(driverId, "DELIVERY_STAFF")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].outcome").value("FAILED"));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM inventory_movements WHERE reference_type='ORDER' AND reference_id=? AND movement_type='RETURN'", Integer.class, orderId)).isZero();
        long attempt = assignmentService.attempts(assignment, driverId, false).getFirst().id();
        service.settle(trip, new SettleTripRequest(BigDecimal.ZERO, BigDecimal.ZERO, 0, 0, null), ownerId, true);
        var pending = returns.pending().stream().filter(p -> p.orderId() == orderId).findFirst().orElseThrow();
        String body = "{\"lines\":[{\"loadItemId\":" + pending.lines().getFirst().loadItemId() + ",\"sellable\":2}]}";
        String inspection = "/api/v1/delivery/attempts/" + attempt + "/return-inspection";
        mvc.perform(post(inspection).with(actor(driverId, "DELIVERY_STAFF")).contentType("application/json").content(body)).andExpect(status().isForbidden());
        mvc.perform(post(inspection).with(actor(ownerId, "SALES_STAFF")).contentType("application/json").content(body)).andExpect(status().isCreated());
        mvc.perform(post(inspection).with(actor(ownerId, "ADMIN")).contentType("application/json").content(body)).andExpect(status().isConflict());
        long nextTrip = service.create(new CreateTripRequest(driverId, null), ownerId, true).id();
        long next = service.addOrder(nextTrip, new AddOrderRequest(orderId, true), ownerId, true).orders().getFirst().id();
        assertThat(next).isNotEqualTo(assignment);
        mvc.perform(post("/api/v1/delivery/assignments/" + next + "/dispatch").with(actor(ownerId, "ADMIN"))).andExpect(status().isCreated());
        service.start(nextTrip, driverId, false);
        mvc.perform(post("/api/v1/delivery/assignments/" + next + "/attempts").with(actor(driverId, "DELIVERY_STAFF"))
            .contentType("application/json").content("{\"outcome\":\"SUCCESS\",\"recipientName\":\"Customer\"}"))
            .andExpect(status().isCreated());
        assertThat(jdbc.queryForObject("SELECT status FROM orders WHERE id=?", String.class, orderId)).isEqualTo("DELIVERED");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM order_dispatches WHERE order_id=?", Integer.class, orderId)).isEqualTo(2);
        assertThat(assignmentService.attempts(assignment, driverId, false).getFirst().outcome()).isEqualTo(Outcome.FAILED);
        assertThat(assignmentService.attempts(next, driverId, false)).hasSize(1);
        assertThat(assignmentService.attempts(next, driverId, false).getFirst().outcome()).isEqualTo(Outcome.SUCCESS);
    }

    @Autowired com.aquaflow.inventory.application.InventoryReturnService returns;

    private long dispatch(long trip) {
        return service.dispatch(trip, ownerId, true).id();
    }

    private void startTrip(long trip, long driver) {
        dispatch(trip);
        service.start(trip, driver, false);
    }

    private long failedTrip() {
        long trip = service.create(new CreateTripRequest(driverId, null), ownerId, true).id();
        service.addOrder(trip, new AddOrderRequest(orderId), ownerId, true);
        startTrip(trip, driverId);
        service.recordResult(trip, orderId, new DeliveryResultRequest(Outcome.FAILED, null, "Vắng nhà", null), driverId, false);
        return trip;
    }

    @Test
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void returnInspectionRestocksOnlySellableAndCannotBeRepeated() throws Exception {
        long trip = failedTrip();
        assertThat(returns.pending()).noneMatch(p -> p.orderId() == orderId);
        service.settle(trip, new SettleTripRequest(BigDecimal.ZERO, BigDecimal.ZERO, 0, 0, null), ownerId, true);
        var pending = returns.pending().stream().filter(p -> p.orderId() == orderId).findFirst().orElseThrow();
        long line = pending.lines().getFirst().loadItemId();
        String body = "{\"orderId\":"+orderId+",\"lines\":[{\"loadItemId\":"+line+",\"sellable\":1}],\"note\":\"Vỡ một bình\"}";
        String base = "/api/v1/inventory/returns";
        mvc.perform(post(base).with(actor(ownerId, "SALES_STAFF")).contentType("application/json").content(body))
            .andExpect(status().isCreated()).andExpect(header().exists("Location"))
            .andExpect(jsonPath("$.lines[0].sellable").value(1));
        assertThat(jdbc.queryForObject("SELECT on_hand FROM inventory_balances WHERE batch_id=?", Integer.class, pending.lines().getFirst().batchId())).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT SUM(quantity) FROM inventory_movements WHERE reference_type='ORDER' AND reference_id=? AND movement_type='RETURN'", Integer.class, orderId)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT status FROM orders WHERE id=?", String.class, orderId)).isEqualTo("CANCELLED");
        assertThat(jdbc.queryForObject("SELECT quantity_returned FROM delivery_load_items WHERE id=?", Integer.class, line)).isEqualTo(2);
        mvc.perform(post(base).with(actor(ownerId, "ADMIN")).contentType("application/json").content(body)).andExpect(status().isConflict());
        assertThat(service.availableOrders(true)).anyMatch(o -> o.id() == orderId && o.redeliveryEligible());
        assertThat(returns.pending()).noneMatch(p -> p.orderId() == orderId);
    }

    @Test
    void invalidInspectionsDoNotChangeStockAndReassignmentBlocksReturns() throws Exception {
        long trip = failedTrip();
        service.settle(trip, new SettleTripRequest(BigDecimal.ZERO, BigDecimal.ZERO, 0, 0, null), ownerId, true);
        var pending = returns.pending().stream().filter(p -> p.orderId() == orderId).findFirst().orElseThrow();
        long line = pending.lines().getFirst().loadItemId();
        String base = "/api/v1/inventory/returns";
        for (String lines : List.of("[]", "[{\"loadItemId\":"+line+",\"sellable\":3}]",
            "[{\"loadItemId\":"+line+",\"sellable\":-1}]", "[{\"loadItemId\":"+line+",\"sellable\":0}]",
            "[{\"loadItemId\":"+line+",\"sellable\":2},{\"loadItemId\":"+line+",\"sellable\":2}]")) {
            mvc.perform(post(base).with(actor(ownerId, "ADMIN")).contentType("application/json")
                .content("{\"orderId\":"+orderId+",\"lines\":"+lines+"}")).andExpect(status().isBadRequest());
        }
        jdbc.update("UPDATE product_batches SET expires_on=? WHERE id=?", LocalDate.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh")), pending.lines().getFirst().batchId());
        mvc.perform(post(base).with(actor(ownerId, "ADMIN")).contentType("application/json")
            .content("{\"orderId\":"+orderId+",\"lines\":[{\"loadItemId\":"+line+",\"sellable\":2}]}")).andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM inventory_returns WHERE order_id=?", Integer.class, orderId)).isZero();
        long retry = service.create(new CreateTripRequest(driverId, null), ownerId, true).id();
        assertThatThrownBy(() -> service.addOrder(retry, new AddOrderRequest(orderId, true), ownerId, true))
                .isInstanceOf(ConflictException.class);
        service.cancel(retry, ownerId, true);
        assertThat(returns.pending()).anyMatch(p -> p.orderId() == orderId);
    }

    @Test
    void returnsResourcesEnforceAccessAndSupportHistory() throws Exception {
        String base = "/api/v1/inventory/returns";
        mvc.perform(get(base)).andExpect(status().isUnauthorized());
        mvc.perform(get(base).with(actor(driverId, "DELIVERY_STAFF"))).andExpect(status().isForbidden());
        mvc.perform(post(base).with(actor(driverId, "DELIVERY_STAFF")).contentType("application/json").content("{}"))
            .andExpect(status().isForbidden());
        mvc.perform(get(base+"/999999999").with(actor(ownerId, "ADMIN"))).andExpect(status().isNotFound());
        mvc.perform(get(base+"?size=101").with(actor(ownerId, "ADMIN"))).andExpect(status().isBadRequest());
        long trip=failedTrip();
        service.settle(trip, new SettleTripRequest(BigDecimal.ZERO, BigDecimal.ZERO, 0, 0, null), ownerId, true);
        long line=returns.pending().stream().filter(p->p.orderId()==orderId).findFirst().orElseThrow().lines().getFirst().loadItemId();
        var result=returns.create(new com.aquaflow.inventory.api.ReturnDtos.Create(orderId,
            List.of(new com.aquaflow.inventory.api.ReturnDtos.LineInput(line,0)),"Hỏng toàn bộ"),ownerId);
        mvc.perform(get(base+"/"+result.id()).with(actor(ownerId,"SALES_STAFF")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.lines[0].sellable").value(0));
        mvc.perform(get(base).with(actor(ownerId,"ADMIN"))).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM inventory_movements WHERE reference_id=? AND reference_type='ORDER' AND movement_type='RETURN'",Integer.class,orderId)).isZero();
    }


    long ownerId;
    long driverId;
    long otherDriverId;
    long orderId;
    long productId;
    long batchId;
    long itemId;

    @BeforeEach
    void prepare() {
        String id = UUID.randomUUID().toString();
        jdbc.update("INSERT INTO roles(code, name) VALUES ('ADMIN','Owner') ON CONFLICT (code) DO NOTHING");
        jdbc.update("INSERT INTO roles(code, name) VALUES ('DELIVERY_STAFF','Driver') ON CONFLICT (code) DO NOTHING");
        ownerId = user("ADMIN", id + "-owner@delivery.test");
        driverId = user("DELIVERY_STAFF", id + "-driver@delivery.test");
        otherDriverId = user("DELIVERY_STAFF", id + "-other@delivery.test");
        productId = jdbc.queryForObject("""
                INSERT INTO products(sku, name, unit, sale_price) VALUES (?, 'Test water', 'binh', 15000)
                RETURNING id
                """, Long.class, id);
        batchId = jdbc.queryForObject("""
                INSERT INTO product_batches(product_id, lot_code, expires_on)
                VALUES (?, ?, ?) RETURNING id
                """, Long.class, productId, id, LocalDate.now().plusDays(90));
        orderId = jdbc.queryForObject("""
                INSERT INTO orders(order_code, channel, fulfillment_type, status, created_by,
                                   recipient_name, delivery_address)
                VALUES (?, 'PHONE', 'DELIVERY', 'PREPARING', ?, 'Nguyen A', '1 Test St')
                RETURNING id
                """, Long.class, id, ownerId);
        itemId = jdbc.queryForObject("""
                INSERT INTO order_items(order_id, product_id, quantity, unit_price, line_total)
                VALUES (?, ?, 2, 15000, 30000) RETURNING id
                """, Long.class, orderId, productId);
        jdbc.update("""
                INSERT INTO inventory_balances(batch_id, on_hand, reserved) VALUES (?, 2, 2)
                """, batchId);
        jdbc.update("""
                INSERT INTO stock_reservations(order_item_id, batch_id, quantity_reserved)
                VALUES (?, ?, 2)
                """, itemId, batchId);
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
            jdbc.update("DELETE FROM audit_logs WHERE entity_type='DELIVERY_TRIP' AND entity_id IN (?, ?)", firstTrip, secondTrip);
            jdbc.update("DELETE FROM delivery_assignments WHERE trip_id IN (?, ?)", firstTrip, secondTrip);
            jdbc.update("DELETE FROM delivery_trips WHERE id IN (?, ?)", firstTrip, secondTrip);
            jdbc.update("DELETE FROM order_dispatch_items WHERE dispatch_id IN (SELECT id FROM order_dispatches WHERE order_id = ?)", orderId);
            jdbc.update("DELETE FROM order_dispatches WHERE order_id = ?", orderId);
            jdbc.update("DELETE FROM stock_reservations WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = ?)", orderId);
            jdbc.update("DELETE FROM order_items WHERE order_id = ?", orderId);
            jdbc.update("DELETE FROM orders WHERE id = ?", orderId);
            jdbc.update("DELETE FROM inventory_balances WHERE batch_id IN (SELECT id FROM product_batches WHERE product_id = ?)", productId);
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
                .andExpect(status().isCreated());
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
        mvc.perform(post(base + "/" + trip + "/dispatch").with(actor(driverId, "DELIVERY_STAFF")))
                .andExpect(status().isForbidden());
        mvc.perform(post(base + "/" + trip + "/dispatch").with(actor(ownerId, "ADMIN")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.orders[0].orderStatus").value("OUT_FOR_DELIVERY"));
        assertThatThrownBy(() -> service.cancel(trip, ownerId, true)).isInstanceOf(ConflictException.class);
        assertThatThrownBy(() -> service.removeOrder(trip, orderId, ownerId, true)).isInstanceOf(ConflictException.class);
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
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void failedDeliveryCanMoveToNewTripAfterHandoverAndHistoryRemainsVisible() {
        long trip = service.create(new CreateTripRequest(driverId, null), ownerId, true).id();
        service.addOrder(trip, new AddOrderRequest(orderId), ownerId, true);
        startTrip(trip, driverId);
        service.start(trip, driverId, false);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM delivery_load_items WHERE assignment_id IN (SELECT id FROM delivery_assignments WHERE trip_id = ?)", Long.class, trip)).isEqualTo(1);
        service.recordResult(trip, orderId, new DeliveryResultRequest(Outcome.FAILED, null, "Vắng nhà", null), driverId, false);
        service.settle(trip, new SettleTripRequest(BigDecimal.ZERO, BigDecimal.ZERO, 0, 0, null), ownerId, true);
        assertThat(service.get(trip, ownerId, true).orders()).hasSize(1);
        assertThat(service.availableOrders(true)).noneMatch(o -> o.id() == orderId);
        var pending = returns.pending().stream().filter(p -> p.orderId() == orderId).findFirst().orElseThrow();
        returns.create(new com.aquaflow.inventory.api.ReturnDtos.Create(orderId,
                List.of(new com.aquaflow.inventory.api.ReturnDtos.LineInput(
                        pending.lines().getFirst().loadItemId(), 2)), null), ownerId);
        assertThat(service.availableOrders(true)).anyMatch(o -> o.id() == orderId && o.redeliveryEligible());
        long abandoned = service.create(new CreateTripRequest(otherDriverId, null), ownerId, true).id();
        service.addOrder(abandoned, new AddOrderRequest(orderId, true), ownerId, true);
        assertThat(jdbc.queryForObject("SELECT status FROM orders WHERE id = ?", String.class, orderId)).isEqualTo("PREPARING");
        assertThat(jdbc.queryForObject("SELECT reserved FROM inventory_balances WHERE batch_id = ?", Integer.class, batchId)).isEqualTo(2);
        service.cancel(abandoned, ownerId, true);
        assertThat(jdbc.queryForObject("SELECT status FROM orders WHERE id = ?", String.class, orderId)).isEqualTo("CANCELLED");
        assertThat(jdbc.queryForObject("SELECT reserved FROM inventory_balances WHERE batch_id = ?", Integer.class, batchId)).isZero();

        jdbc.update("UPDATE product_batches SET expires_on = ? WHERE id = ?", LocalDate.now().minusDays(1), batchId);
        long redeliveryBatch = jdbc.queryForObject("""
                INSERT INTO product_batches(product_id, lot_code, expires_on)
                VALUES (?, 'REDELIVERY-LOT', ?) RETURNING id
                """, Long.class, productId, LocalDate.now().plusDays(120));
        jdbc.update("INSERT INTO inventory_balances(batch_id, on_hand, reserved) VALUES (?, 2, 0)", redeliveryBatch);

        long replacement = service.create(new CreateTripRequest(otherDriverId, null), ownerId, true).id();
        service.addOrder(replacement, new AddOrderRequest(orderId, true), ownerId, true);
        assertThat(jdbc.queryForObject("SELECT cancelled_at FROM orders WHERE id = ?",
                java.time.OffsetDateTime.class, orderId)).isNull();
        startTrip(replacement, otherDriverId);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM order_dispatches WHERE order_id = ?", Integer.class, orderId))
                .isEqualTo(2);
        assertThat(jdbc.queryForObject("""
                SELECT SUM(quantity_loaded) FROM delivery_load_items l
                JOIN delivery_assignments a ON a.id = l.assignment_id WHERE a.trip_id = ?
                """, Integer.class, replacement)).isEqualTo(2);

        var firstTripOrder = service.get(trip, ownerId, true).orders().getFirst();
        var redeliveryTripOrder = service.get(replacement, ownerId, true).orders().getFirst();
        assertThat(firstTripOrder.items()).hasSize(1);
        assertThat(firstTripOrder.items().getFirst().lotCode()).isNotEqualTo("REDELIVERY-LOT");
        assertThat(redeliveryTripOrder.items()).singleElement()
                .satisfies(line -> assertThat(line.lotCode()).isEqualTo("REDELIVERY-LOT"));

        service.recordResult(replacement, orderId, new DeliveryResultRequest(Outcome.SUCCESS, "Khách", null, null), otherDriverId, false);
        assertThat(service.get(trip, ownerId, true).orders().getFirst().latestAttempt().outcome()).isEqualTo(Outcome.FAILED);
        assertThat(service.availableOrders(true)).noneMatch(o -> o.id() == orderId);
    }

    @Test
    void incompleteTripAndUnexplainedHandoverMismatchAreRejected() {
        long trip = service.create(new CreateTripRequest(driverId, null), ownerId, true).id();
        assertThatThrownBy(() -> service.start(trip, driverId, false)).isInstanceOf(ConflictException.class);
        service.addOrder(trip, new AddOrderRequest(orderId), ownerId, true);
        dispatch(trip);
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

        dispatch(tripId);
        var started = service.start(tripId, driverId, false);
        assertThat(started.status()).isEqualTo("IN_PROGRESS");
        assertThat(jdbc.queryForObject("SELECT SUM(quantity_loaded) FROM delivery_load_items WHERE assignment_id = ?",
                Long.class, started.orders().getFirst().id())).isEqualTo(2L);

        service.recordResult(tripId, orderId,
                new DeliveryResultRequest(Outcome.SUCCESS, "Nguoi nhan", null, "Giao lai thanh cong"), driverId, false);
        assertThat(jdbc.queryForObject("SELECT status FROM orders WHERE id = ?", String.class, orderId))
                .isEqualTo("DELIVERED");
        assertThat(jdbc.queryForObject("SELECT payment_status FROM orders WHERE id = ?", String.class, orderId))
                .isEqualTo("UNPAID");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM inventory_movements WHERE reference_type = 'ORDER' AND reference_id = ? AND movement_type = 'DISPATCH'",
                Long.class, orderId)).isEqualTo(1L);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM inventory_movements WHERE reference_type = 'ORDER' AND reference_id = ? AND movement_type = 'RETURN'",
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
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void tripDispatchKeepsEarlierAssignmentWhenLaterAssignmentCannotReserveStock() {
        long secondOrder = jdbc.queryForObject("""
                INSERT INTO orders(order_code, channel, fulfillment_type, status, created_by,
                                   recipient_name, delivery_address)
                VALUES (?, 'PHONE', 'DELIVERY', 'PREPARING', ?, 'Nguyen B', '2 Test St')
                RETURNING id
                """, Long.class, UUID.randomUUID().toString(), ownerId);
        jdbc.update("""
                INSERT INTO order_items(order_id, product_id, quantity, unit_price, line_total)
                VALUES (?, ?, 1, 15000, 15000)
                """, secondOrder, productId);
        long trip = service.create(new CreateTripRequest(driverId, null), ownerId, true).id();
        service.addOrder(trip, new AddOrderRequest(orderId), ownerId, true);
        service.addOrder(trip, new AddOrderRequest(secondOrder), ownerId, true);

        assertThatThrownBy(() -> service.dispatch(trip, ownerId, true)).isInstanceOf(ConflictException.class);
        assertThat(jdbc.queryForObject("SELECT status FROM orders WHERE id = ?", String.class, orderId)).isEqualTo("OUT_FOR_DELIVERY");
        assertThat(jdbc.queryForObject("SELECT status FROM orders WHERE id = ?", String.class, secondOrder)).isEqualTo("PREPARING");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM order_dispatches WHERE order_id = ?",
                Integer.class, orderId)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM order_dispatches WHERE order_id = ?",
                Integer.class, secondOrder)).isZero();
        assertThat(jdbc.queryForObject("SELECT on_hand FROM inventory_balances WHERE batch_id = ?", Integer.class, batchId)).isZero();
        assertThat(jdbc.queryForObject("SELECT reserved FROM inventory_balances WHERE batch_id = ?", Integer.class, batchId)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM inventory_movements WHERE reference_type='ORDER' AND reference_id=?",
                Integer.class, orderId)).isEqualTo(1);
    }

    @Test
    void redeliveryRequiresInspectedReturnAndAvailableStockAndRollsBackOnShortage() {
        long trip = failedTrip();
        service.settle(trip, new SettleTripRequest(BigDecimal.ZERO, BigDecimal.ZERO, 0, 0, null), ownerId, true);
        var pending = returns.pending().stream().filter(p -> p.orderId() == orderId).findFirst().orElseThrow();
        returns.create(new com.aquaflow.inventory.api.ReturnDtos.Create(orderId,
                List.of(new com.aquaflow.inventory.api.ReturnDtos.LineInput(
                        pending.lines().getFirst().loadItemId(), 0)), "Hàng hỏng"), ownerId);

        long retry = service.create(new CreateTripRequest(otherDriverId, null), ownerId, true).id();
        assertThatThrownBy(() -> service.addOrder(retry, new AddOrderRequest(orderId, true), ownerId, true))
                .isInstanceOf(ConflictException.class);
        assertThat(jdbc.queryForObject("SELECT status FROM orders WHERE id = ?", String.class, orderId)).isEqualTo("CANCELLED");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM delivery_assignments WHERE order_id = ? AND active", Integer.class, orderId))
                .isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM order_dispatches WHERE order_id = ?", Integer.class, orderId))
                .isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT on_hand FROM inventory_balances WHERE batch_id = ?", Integer.class, batchId)).isZero();
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

    @Test void driverCollectionsAreScopedIdempotentAndUpdatePaymentStatus() throws Exception {
        long trip = service.create(new CreateTripRequest(driverId, null), ownerId, true).id();
        service.addOrder(trip, new AddOrderRequest(orderId), ownerId, true);
        dispatch(trip);
        service.start(trip, driverId, false);
        jdbc.update("UPDATE orders SET subtotal=30000 WHERE id=?", orderId);
        String path = "/api/v1/delivery/trips/"+trip+"/orders/"+orderId+"/collections";
        String body = "{\"requestId\":\""+UUID.randomUUID()+"\",\"amount\":10000,\"method\":\"CASH\",\"bottlesReturned\":0}";
        mvc.perform(post(path).with(actor(otherDriverId,"DELIVERY_STAFF")).contentType("application/json").content(body)).andExpect(status().isForbidden());
        for (int i=0; i<2; i++) mvc.perform(post(path).with(actor(driverId,"DELIVERY_STAFF")).contentType("application/json").content(body))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.balances[0].due").value(20000)).andExpect(jsonPath("$.cashExpected").value(10000));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM payments WHERE order_id=?",Integer.class,orderId)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT payment_status FROM orders WHERE id=?",String.class,orderId)).isEqualTo("PARTIALLY_PAID");
        mvc.perform(post(path).with(actor(driverId,"DELIVERY_STAFF")).contentType("application/json").content(body.replace("10000","30000")))
            .andExpect(status().isConflict());
        service.recordResult(trip,orderId,new DeliveryResultRequest(Outcome.SUCCESS,"Recipient",null,null),driverId,false);
        service.collect(trip,orderId,new CollectionRequest(UUID.randomUUID(),new BigDecimal("20000"),"BANK_TRANSFER",0),driverId,false);
        assertThat(jdbc.queryForObject("SELECT payment_status FROM orders WHERE id=?",String.class,orderId)).isEqualTo("PAID");
        assertThat(service.collections(trip,driverId,false).cashExpected()).isEqualByComparingTo("10000");
        service.settle(trip,new SettleTripRequest(new BigDecimal("10000"),new BigDecimal("10000"),0,0,null),ownerId,true);
    }

    @Test void salesCanCreateAssignAndSettleButDriversCannotManageTrips() throws Exception {
        String base = "/api/v1/delivery/trips";
        mvc.perform(get("/api/v1/delivery/drivers").with(actor(ownerId,"SALES_STAFF"))).andExpect(status().isOk());
        long trip = service.create(new CreateTripRequest(driverId,null),ownerId,true).id();
        mvc.perform(post(base+"/"+trip+"/orders").with(actor(ownerId,"SALES_STAFF")).contentType("application/json")
            .content("{\"orderId\":"+orderId+"}")).andExpect(status().isCreated());
        mvc.perform(put(base+"/"+trip+"/driver").with(actor(driverId,"DELIVERY_STAFF")).contentType("application/json")
            .content("{\"driverId\":"+otherDriverId+"}")).andExpect(status().isForbidden());
        mvc.perform(post(base+"/"+trip+"/dispatch").with(actor(ownerId,"SALES_STAFF")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.orders[0].orderStatus").value("OUT_FOR_DELIVERY"));
        mvc.perform(put(base+"/"+trip+"/departure").with(actor(ownerId,"SALES_STAFF"))).andExpect(status().isOk());
        service.recordResult(trip,orderId,new DeliveryResultRequest(Outcome.SUCCESS,"Recipient",null,null),driverId,false);
        mvc.perform(put(base+"/"+trip+"/settlement").with(actor(ownerId,"SALES_STAFF")).contentType("application/json")
            .content("{\"cashReported\":0,\"cashConfirmed\":0,\"bottlesExpected\":0,\"bottlesConfirmed\":0}")).andExpect(status().isOk());
    }
}
