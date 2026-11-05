package com.aquaflow.workspace;

import com.aquaflow.workspace.api.CreateNotificationRequest;
import com.aquaflow.workspace.application.NotificationService;
import com.aquaflow.workspace.application.OwnerAlertService;
import com.aquaflow.workspace.repository.NotificationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties = {"app.jwt.secret=test-test-test-test-test-test-test-test",
        "app.notifications.owner-alerts.enabled=false"})
@EnabledIfEnvironmentVariable(named = "DB_URL", matches = ".+")
@Transactional
class OwnerAlertPostgresIntegrationTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired NotificationRepository repository;
    @Autowired NotificationService notifications;
    @Autowired javax.sql.DataSource dataSource;
    private static final Instant NOW = Instant.parse("2026-11-01T17:30:00Z");
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 2);
    private OwnerAlertService alerts;
    private long admin;
    private final String prefix = UUID.randomUUID().toString().substring(0, 8);

    @BeforeEach void setup() {
        alerts = new OwnerAlertService(repository, Clock.fixed(NOW, ZoneId.of("Asia/Ho_Chi_Minh")));
        admin = account("ADMIN", "ACTIVE");
        jdbc.update("UPDATE store_settings SET settings = jsonb_set(settings, '{expiryWarningDays}', '30') WHERE id = 1");
    }

    private long account(String role, String status) {
        jdbc.update("INSERT INTO roles(code, name) VALUES (?, ?) ON CONFLICT (code) DO NOTHING", role, role);
        return jdbc.queryForObject("""
                INSERT INTO users(role_id, full_name, email, password_hash, status)
                VALUES ((SELECT id FROM roles WHERE code = ?), 'Owner alert test', ?, 'unused', ?) RETURNING id
                """, Long.class, role, UUID.randomUUID() + "@example.invalid", status);
    }

    private long order(String status, String fulfillment, Instant appointment) {
        return jdbc.queryForObject("""
                INSERT INTO orders(order_code, channel, fulfillment_type, status, requested_delivery_at)
                VALUES (?, 'WEB', ?, ?, ?) RETURNING id
                """, Long.class, prefix + "-" + UUID.randomUUID(), fulfillment, status,
                appointment == null ? null : Timestamp.from(appointment));
    }

    private long product(int threshold) {
        return jdbc.queryForObject("""
                INSERT INTO products(sku, name, unit, low_stock_threshold) VALUES (?, 'Nước thử', 'Bình', ?) RETURNING id
                """, Long.class, prefix + UUID.randomUUID(), threshold);
    }

    private long batch(long product, LocalDate expiry, int onHand, int reserved) {
        long id = jdbc.queryForObject("""
                INSERT INTO product_batches(product_id, lot_code, expires_on) VALUES (?, ?, ?) RETURNING id
                """, Long.class, product, UUID.randomUUID().toString(), java.sql.Date.valueOf(expiry));
        jdbc.update("INSERT INTO inventory_balances(batch_id, on_hand, reserved) VALUES (?, ?, ?)", id, onHand, reserved);
        return id;
    }

    private long count(long recipient, String kind, long entity, boolean activeOnly) {
        return jdbc.queryForObject("""
                SELECT COUNT(*) FROM notifications WHERE recipient_id = ? AND kind = ? AND entity_id = ?
                    AND (NOT ? OR resolved_at IS NULL)
                """, Long.class, recipient, kind, entity, activeOnly);
    }

    @Test void pendingAlertsOnlyReachActiveOwnersAndDoNotRepeatAfterRead() {
        long otherAdmin = account("ADMIN", "ACTIVE");
        long inactive = account("ADMIN", "INACTIVE");
        long sales = account("SALES_STAFF", "ACTIVE");
        long customer = account("CUSTOMER", "ACTIVE");
        long id = order("PENDING", "DELIVERY", null);
        alerts.refresh();
        notifications.markAllRead(admin);
        alerts.refresh();
        assertThat(count(admin, "ORDER_PENDING", id, true)).isEqualTo(1);
        assertThat(count(otherAdmin, "ORDER_PENDING", id, true)).isEqualTo(1);
        assertThat(count(inactive, "ORDER_PENDING", id, false)).isZero();
        assertThat(count(sales, "ORDER_PENDING", id, false)).isZero();
        assertThat(count(customer, "ORDER_PENDING", id, false)).isZero();
        assertThat(notifications.unreadCount(admin)).isZero();
        assertThat(notifications.unreadCount(otherAdmin)).isGreaterThanOrEqualTo(1);
        jdbc.update("UPDATE orders SET status = 'CONFIRMED' WHERE id = ?", id);
        alerts.refresh();
        assertThat(count(admin, "ORDER_PENDING", id, true)).isZero();
        assertThat(count(admin, "ORDER_PENDING", id, false)).isEqualTo(1);
    }

    @Test void overdueOnlyForOpenDeliveryOrdersStrictlyPastAppointment() {
        long late = order("PREPARING", "DELIVERY", NOW.minusSeconds(1));
        long atBoundary = order("PREPARING", "DELIVERY", NOW);
        long future = order("PREPARING", "DELIVERY", NOW.plusSeconds(1));
        long counter = order("PREPARING", "COUNTER", NOW.minusSeconds(1));
        long delivered = order("DELIVERED", "DELIVERY", NOW.minusSeconds(1));
        long cancelled = order("CANCELLED", "DELIVERY", NOW.minusSeconds(1));
        alerts.refresh();
        assertThat(count(admin, "ORDER_OVERDUE", late, true)).isEqualTo(1);
        for (long id : new long[]{atBoundary, future, counter, delivered, cancelled}) {
            assertThat(count(admin, "ORDER_OVERDUE", id, false)).isZero();
        }
        jdbc.update("UPDATE orders SET requested_delivery_at = ? WHERE id = ?", Timestamp.from(NOW.plusSeconds(3600)), late);
        alerts.refresh();
        assertThat(count(admin, "ORDER_OVERDUE", late, true)).isZero();
    }

    @Test void stockUsesUnexpiredAvailableQuantityAndRealertsOnlyAfterRecovery() {
        long id = product(10);
        long goodBatch = batch(id, TODAY.plusDays(90), 20, 10);
        batch(id, TODAY, 100, 0); // Today is already unsellable in StockService.
        alerts.refresh();
        assertThat(count(admin, "LOW_STOCK", id, true)).isEqualTo(1);
        notifications.markAllRead(admin);
        jdbc.update("UPDATE inventory_balances SET reserved = 11 WHERE batch_id = ?", goodBatch);
        alerts.refresh();
        assertThat(count(admin, "LOW_STOCK", id, false)).isEqualTo(1);
        assertThat(notifications.unreadCount(admin)).isZero();
        jdbc.update("UPDATE inventory_balances SET reserved = 0 WHERE batch_id = ?", goodBatch);
        alerts.refresh();
        assertThat(count(admin, "LOW_STOCK", id, true)).isZero();
        jdbc.update("UPDATE inventory_balances SET reserved = 15 WHERE batch_id = ?", goodBatch);
        alerts.refresh();
        assertThat(count(admin, "LOW_STOCK", id, true)).isEqualTo(1);
        assertThat(count(admin, "LOW_STOCK", id, false)).isEqualTo(2);
        assertThat(notifications.unreadCount(admin)).isEqualTo(1);
    }

    @Test void expiryUsesVietnamDateConfiguredWindowAndPhysicalStock() {
        long id = product(0);
        long expired = batch(id, TODAY, 2, 0);
        long soon = batch(id, TODAY.plusDays(30), 2, 2);
        long later = batch(id, TODAY.plusDays(31), 2, 0);
        long empty = batch(id, TODAY.plusDays(1), 0, 0);
        alerts.refresh();
        assertThat(count(admin, "BATCH_EXPIRED", expired, true)).isEqualTo(1);
        assertThat(count(admin, "BATCH_EXPIRING", soon, true)).isEqualTo(1);
        assertThat(count(admin, "BATCH_EXPIRING", later, false)).isZero();
        assertThat(count(admin, "BATCH_EXPIRING", empty, false)).isZero();
        jdbc.update("UPDATE store_settings SET settings = jsonb_set(settings, '{expiryWarningDays}', '0') WHERE id = 1");
        alerts.refresh();
        assertThat(count(admin, "BATCH_EXPIRING", soon, true)).isZero();
        assertThat(count(admin, "BATCH_EXPIRED", expired, true)).isEqualTo(1);
    }

    @Test void inactiveProductsAreExcludedAndNoBatchMeansZeroAvailable() {
        long empty = product(0);
        long inactive = product(10);
        batch(inactive, TODAY.minusDays(1), 5, 0);
        jdbc.update("UPDATE products SET active = false WHERE id = ?", inactive);
        alerts.refresh();
        assertThat(count(admin, "LOW_STOCK", empty, true)).isEqualTo(1);
        assertThat(count(admin, "LOW_STOCK", inactive, false)).isZero();
    }

    @Test void latestActiveDeliveryAttemptDeterminesFailureAlert() {
        long id = order("OUT_FOR_DELIVERY", "DELIVERY", NOW.minusSeconds(1));
        long trip = jdbc.queryForObject("INSERT INTO delivery_trips(created_by) VALUES (?) RETURNING id", Long.class, admin);
        long assignment = jdbc.queryForObject("INSERT INTO delivery_assignments(trip_id, order_id) VALUES (?, ?) RETURNING id", Long.class, trip, id);
        jdbc.update("INSERT INTO delivery_attempts(assignment_id, attempt_no, outcome, failure_reason) VALUES (?, 1, 'FAILED', 'Khách vắng nhà')", assignment);
        alerts.refresh();
        assertThat(count(admin, "DELIVERY_FAILED", id, true)).isEqualTo(1);
        assertThat(count(admin, "ORDER_OVERDUE", id, true)).isZero();
        jdbc.update("INSERT INTO delivery_attempts(assignment_id, attempt_no, outcome) VALUES (?, 2, 'SUCCESS')", assignment);
        jdbc.update("UPDATE orders SET status = 'DELIVERED' WHERE id = ?", id);
        alerts.refresh();
        assertThat(count(admin, "DELIVERY_FAILED", id, true)).isZero();
    }

    @Test void resolvedUnreadIsExcludedAndManualMessageIsUntouched() {
        long id = order("PENDING", "DELIVERY", null);
        var manual = notifications.create(new CreateNotificationRequest(admin, "Thông báo", "Giờ mở cửa"), admin);
        alerts.refresh();
        jdbc.update("UPDATE orders SET status = 'CANCELLED' WHERE id = ?", id);
        alerts.refresh();
        assertThat(notifications.list(admin, true, 0, 100)).extracting(n -> n.id()).contains(manual.id());
        assertThat(count(admin, "ORDER_PENDING", id, true)).isZero();
        assertThat(repository.find(manual.id(), admin).orElseThrow().resolvedAt()).isNull();
        assertThat(notifications.unreadCount(admin)).isEqualTo(1);
    }

    @Test void demotedOwnerCannotReadPreviousBusinessAlertsEvenBeforeNextScan() {
        order("PENDING", "DELIVERY", null);
        alerts.refresh();
        long notificationId = notifications.list(admin, true, 0, 100).getFirst().id();
        jdbc.update("INSERT INTO roles(code, name) VALUES ('SALES_STAFF', 'Sales') ON CONFLICT (code) DO NOTHING");
        jdbc.update("UPDATE users SET role_id = (SELECT id FROM roles WHERE code = 'SALES_STAFF') WHERE id = ?", admin);
        assertThat(repository.find(notificationId, admin)).isEmpty();
        assertThat(notifications.list(admin, false, 0, 100)).isEmpty();
        assertThat(notifications.unreadCount(admin)).isZero();
    }

    @Test void anotherDatabaseConnectionHoldingScanLockPreventsOverlappingGeneration() throws Exception {
        long id = order("PENDING", "DELIVERY", null);
        try (var connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            try (var statement = connection.createStatement()) {
                statement.execute("SELECT pg_advisory_xact_lock(741021, 1)");
                alerts.refresh();
                assertThat(count(admin, "ORDER_PENDING", id, false)).isZero();
            } finally {
                connection.rollback();
            }
        }
        alerts.refresh();
        alerts.refresh();
        assertThat(count(admin, "ORDER_PENDING", id, false)).isEqualTo(1);
    }
}
