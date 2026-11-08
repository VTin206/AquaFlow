package com.aquaflow.auth.repository;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.time.Instant;
import java.sql.Timestamp;
import java.util.Optional;

@Repository
public class PasswordResetRepository {
    public record Account(long id, String email, int version, boolean active) {}
    public record Reset(long userId, int version, Instant createdAt, Instant expiresAt) {}
    private final JdbcTemplate jdbc;
    public PasswordResetRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public Optional<Account> lockEmail(String email) {
        return jdbc.query("SELECT id,email,credentials_version,status FROM users WHERE lower(email)=lower(?) FOR UPDATE",
                (rs, n) -> new Account(rs.getLong(1), rs.getString(2), rs.getInt(3), "ACTIVE".equals(rs.getString(4))), email).stream().findFirst();
    }
    public Optional<Account> lockUser(long id) {
        return jdbc.query("SELECT id,email,credentials_version,status FROM users WHERE id=? FOR UPDATE",
                (rs, n) -> new Account(rs.getLong(1), rs.getString(2), rs.getInt(3), "ACTIVE".equals(rs.getString(4))), id).stream().findFirst();
    }
    public Optional<Reset> find(String hash) {
        return jdbc.query("SELECT user_id,credentials_version,created_at,expires_at FROM password_resets WHERE token_hash=?",
                (rs, n) -> new Reset(rs.getLong(1), rs.getInt(2), rs.getTimestamp(3).toInstant(), rs.getTimestamp(4).toInstant()), hash).stream().findFirst();
    }
    public boolean recentlyRequested(long userId, Instant since) {
        return Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM password_resets WHERE user_id=? AND created_at>?)", Boolean.class, userId, Timestamp.from(since)));
    }
    public void save(String hash, Account user, Instant now) {
        jdbc.update("DELETE FROM password_resets WHERE user_id=?", user.id());
        jdbc.update("INSERT INTO password_resets(token_hash,user_id,credentials_version,created_at,expires_at) VALUES (?,?,?,?,?)",
                hash, user.id(), user.version(), Timestamp.from(now), Timestamp.from(now.plusSeconds(900)));
    }
    public void consume(Account user, String passwordHash) {
        jdbc.update("UPDATE users SET password_hash=?,credentials_version=credentials_version+1 WHERE id=?", passwordHash, user.id());
        jdbc.update("DELETE FROM password_resets WHERE user_id=?", user.id());
    }
}
