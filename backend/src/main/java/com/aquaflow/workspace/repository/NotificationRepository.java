package com.aquaflow.workspace.repository;

import com.aquaflow.workspace.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.time.Instant;
import java.time.LocalDate;
import java.sql.Timestamp;

@Repository
public class NotificationRepository {
    private final JdbcTemplate jdbc;
    // A demoted owner must not retain access to business alerts through the inbox.
    private static final String VISIBLE = """
             AND (source_key IS NULL OR EXISTS (
                SELECT 1 FROM users u JOIN roles r ON r.id = u.role_id
                WHERE u.id = notifications.recipient_id AND u.status = 'ACTIVE' AND r.code = 'ADMIN'))
            """;
    private static final RowMapper<NotificationResponse> ROW = (rs, row) -> {
        var readAt = rs.getTimestamp("read_at");
        var resolvedAt = rs.getTimestamp("resolved_at");
        return new NotificationResponse(rs.getLong("id"), rs.getString("title"), rs.getString("message"),
                rs.getTimestamp("created_at").toInstant(), readAt == null ? null : readAt.toInstant(),
                rs.getString("kind"), rs.getString("entity_type"), rs.getObject("entity_id", Long.class),
                resolvedAt == null ? null : resolvedAt.toInstant());
    };

    public NotificationRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public List<NotificationResponse> list(long recipient, boolean unreadOnly, int page, int size) {
        return jdbc.query("""
                SELECT * FROM notifications WHERE recipient_id = ? AND (NOT ? OR (read_at IS NULL AND resolved_at IS NULL))
                """ + VISIBLE + " ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
                ROW, recipient, unreadOnly, size, (long) page * size);
    }

    public long unreadCount(long recipient) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM notifications WHERE recipient_id = ? AND read_at IS NULL AND resolved_at IS NULL" + VISIBLE,
                Long.class, recipient);
    }

    public Optional<NotificationResponse> find(long id, long recipient) {
        return jdbc.query("SELECT * FROM notifications WHERE id = ? AND recipient_id = ?" + VISIBLE, ROW, id, recipient)
                .stream().findFirst();
    }

    public void markRead(long id, long recipient) {
        jdbc.update("UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE id = ? AND recipient_id = ? AND read_at IS NULL",
                id, recipient);
    }

    public int markAllRead(long recipient) {
        return jdbc.update("UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE recipient_id = ? AND read_at IS NULL AND resolved_at IS NULL", recipient);
    }

    public NotificationResponse create(CreateNotificationRequest request, long actor) {
        return jdbc.queryForObject("""
                INSERT INTO notifications(recipient_id, title, message, created_by) VALUES (?, ?, ?, ?) RETURNING *
                """, ROW, request.recipientId(), request.title().trim(), request.message().trim(), actor);
    }

    /** Transaction-scoped lock prevents overlapping scans across application instances. */
    public boolean tryLockOwnerAlerts() {
        return Boolean.TRUE.equals(jdbc.queryForObject("SELECT pg_try_advisory_xact_lock(741021, 1)", Boolean.class));
    }

    public void reconcileOwnerAlerts(LocalDate today, Instant checkedAt) {
        jdbc.update(OwnerAlertSql.RECONCILE, java.sql.Date.valueOf(today), Timestamp.from(checkedAt));
    }
}
