package com.aquaflow.delivery.application;

import com.aquaflow.delivery.api.dto.CreateDeliveryAssignmentRequest;
import com.aquaflow.delivery.api.dto.CreateDeliveryTripRequest;
import com.aquaflow.shared.api.ConflictException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Uses an ephemeral PostgreSQL container; never points at the runtime database. */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(properties = "app.jwt.secret=test-test-test-test-test-test-test-test")
class DeliveryTripPostgresIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("aquaflow_be1_test")
            .withUsername("test_user")
            .withPassword("test_password");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired JdbcTemplate jdbc;
    @Autowired DeliveryTripService service;

    private Long adminId;
    private Long driverId;
    private Long salesId;
    private String suffix;

    @BeforeEach
    void setUp() {
        suffix = UUID.randomUUID().toString().substring(0, 8);
        adminId = insertUser("ADMIN", "Admin");
        driverId = insertUser("DELIVERY_STAFF", "Driver");
        salesId = insertUser("SALES_STAFF", "Sales");
    }

    @Test
    void tripAndDeliveryAssignmentPersistAndCounterOrdersAreRejected() {
        Long deliveryOrderId = insertOrder("DELIVERY", "PREPARING");
        Long counterOrderId = insertOrder("COUNTER", "PREPARING");

        var trip = service.create(new CreateDeliveryTripRequest(driverId), adminId);
        var assigned = service.addAssignment(trip.id(), new CreateDeliveryAssignmentRequest(deliveryOrderId));

        assertThat(assigned.assignments()).hasSize(1);
        assertThat(jdbc.queryForObject("SELECT status FROM delivery_trips WHERE id = ?", String.class, trip.id()))
                .isEqualTo("CREATED");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM delivery_assignments WHERE order_id = ? AND active", Integer.class, deliveryOrderId))
                .isEqualTo(1);
        assertThatThrownBy(() -> service.addAssignment(trip.id(), new CreateDeliveryAssignmentRequest(counterOrderId)))
                .isInstanceOf(com.aquaflow.shared.api.BadRequestException.class);
        assertThat(jdbc.queryForObject("SELECT status FROM orders WHERE id = ?", String.class, deliveryOrderId))
                .isEqualTo("PREPARING");
    }

    @Test
    void concurrentRequestsCannotAssignOneOrderToTwoActiveTrips() throws Exception {
        Long orderId = insertOrder("DELIVERY", "PREPARING");
        Long tripOne = service.create(new CreateDeliveryTripRequest(driverId), adminId).id();
        Long tripTwo = service.create(new CreateDeliveryTripRequest(driverId), salesId).id();

        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        List<Future<Boolean>> results = new ArrayList<>();
        for (Long tripId : List.of(tripOne, tripTwo)) {
            results.add(pool.submit(() -> {
                start.await();
                try {
                    service.addAssignment(tripId, new CreateDeliveryAssignmentRequest(orderId));
                    return true;
                } catch (ConflictException exception) {
                    return false;
                }
            }));
        }
        start.countDown();

        int successes = 0;
        for (Future<Boolean> result : results) {
            successes += result.get() ? 1 : 0;
        }
        pool.shutdown();

        assertThat(successes).isEqualTo(1);
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM delivery_assignments WHERE order_id = ? AND active", Integer.class, orderId))
                .isEqualTo(1);
    }

    private Long insertUser(String roleCode, String name) {
        jdbc.update("INSERT INTO roles (code, name) VALUES (?, ?) ON CONFLICT (code) DO NOTHING", roleCode, roleCode);
        Long roleId = jdbc.queryForObject("SELECT id FROM roles WHERE code = ?", Long.class, roleCode);
        return jdbc.queryForObject("""
                INSERT INTO users (role_id, full_name, email, phone, password_hash, status)
                VALUES (?, ?, ?, '0900000000', 'test-hash', 'ACTIVE') RETURNING id
                """, Long.class, roleId, name, roleCode.toLowerCase() + "-" + suffix + "@example.test");
    }

    private Long insertOrder(String fulfillment, String status) {
        return jdbc.queryForObject("""
                INSERT INTO orders (order_code, channel, fulfillment_type, status)
                VALUES (?, 'WEB', ?, ?) RETURNING id
                """, Long.class, "TRIP-" + suffix + "-" + UUID.randomUUID().toString().substring(0, 4), fulfillment, status);
    }
}
