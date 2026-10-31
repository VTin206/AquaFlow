package com.aquaflow.workspace;

import com.aquaflow.workspace.api.*;
import com.aquaflow.workspace.application.*;
import com.aquaflow.workspace.repository.NotificationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.*;

/** Uses only an explicitly configured test database, like the existing persistence suite. */
@SpringBootTest(properties = "app.jwt.secret=test-test-test-test-test-test-test-test")
@EnabledIfEnvironmentVariable(named = "DB_URL", matches = ".+")
@Transactional
class WorkspacePostgresIntegrationTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired StoreSettingsService settings;
    @Autowired NotificationService notifications;
    @Autowired NotificationRepository notificationRepository;

    private long account(String email) {
        jdbc.update("INSERT INTO roles(code, name) VALUES ('ADMIN', 'Administrator') ON CONFLICT (code) DO NOTHING");
        return jdbc.queryForObject("""
                INSERT INTO users(role_id, full_name, email, password_hash, status)
                VALUES ((SELECT id FROM roles WHERE code = 'ADMIN'), 'Workspace test', ?, 'unused', 'ACTIVE') RETURNING id
                """, Long.class, email);
    }

    @Test void settingsPersistAndAuditIncrementsVersion() {
        long admin = account("workspace-settings@example.com");
        var before = settings.get();
        var value = new StoreSettingsData("Cửa hàng", "Địa chỉ", "0901234567", "store@example.com",
                "6:00–21:00", null, null, null, null, "Cảm ơn", 60, 15);
        var saved = settings.update(new UpdateStoreSettingsRequest(value, before.version()), admin);
        assertThat(saved.settings()).isEqualTo(value);
        assertThat(saved.version()).isEqualTo(before.version() + 1);
        assertThat(saved.updatedBy()).isEqualTo(admin);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM audit_logs WHERE actor_id = ? AND entity_type = 'STORE_SETTINGS'",
                Long.class, admin)).isEqualTo(1);
    }

    @Test void inboxIsolationPaginationAndReadIdempotency() {
        long alice = account("workspace-alice@example.com");
        long bob = account("workspace-bob@example.com");
        var first = notifications.create(new CreateNotificationRequest(alice, "One", "Message one"), bob);
        notifications.create(new CreateNotificationRequest(alice, "Two", "Message two"), bob);
        var other = notifications.create(new CreateNotificationRequest(bob, "Private", "For Bob"), bob);
        assertThat(notifications.unreadCount(alice)).isEqualTo(2);
        assertThat(notifications.list(alice, true, 0, 1)).hasSize(1);
        assertThat(notifications.list(alice, true, 1, 1)).hasSize(1);
        assertThat(notificationRepository.find(other.id(), alice)).isEmpty();
        // Test repository isolation directly: expected exception in a transactional service
        // would deliberately mark this test transaction rollback-only.
        notificationRepository.markRead(other.id(), alice);
        assertThat(notifications.unreadCount(bob)).isEqualTo(1);
        var read = notifications.markRead(first.id(), alice);
        assertThat(read.readAt()).isNotNull();
        assertThat(notifications.markRead(first.id(), alice).readAt()).isEqualTo(read.readAt());
        assertThat(notifications.markAllRead(alice)).isEqualTo(1);
        assertThat(notifications.markAllRead(alice)).isZero();
        assertThat(notifications.list(alice, true, 0, 20)).isEmpty();
        assertThat(notifications.unreadCount(bob)).isEqualTo(1);
    }
}
