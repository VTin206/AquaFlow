package com.aquaflow.auth.repository;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/** Bảng refresh_tokens (V27): chỉ giữ SHA-256 của token. */
@Repository
public class RefreshTokenRepository {

    public record Token(long id, UUID familyId, long userId, int credentialsVersion, Instant expiresAt, Instant revokedAt) {
        public boolean revoked() {
            return revokedAt != null;
        }
    }

    private final JdbcTemplate jdbc;

    public RefreshTokenRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(String hash, UUID familyId, long userId, int credentialsVersion, Instant createdAt, Instant expiresAt) {
        jdbc.update("""
                        INSERT INTO refresh_tokens (token_hash, family_id, user_id, credentials_version, created_at, expires_at)
                        VALUES (?, ?, ?, ?, ?, ?)""",
                hash, familyId, userId, credentialsVersion, Timestamp.from(createdAt), Timestamp.from(expiresAt));
    }

    /** Khóa dòng để hai yêu cầu làm mới cùng lúc bằng một token không cùng xoay vòng được. */
    public Optional<Token> lock(String hash) {
        return jdbc.query("""
                        SELECT id, family_id, user_id, credentials_version, expires_at, revoked_at
                        FROM refresh_tokens WHERE token_hash = ? FOR UPDATE""",
                (rs, n) -> {
                    Timestamp revoked = rs.getTimestamp("revoked_at");
                    return new Token(rs.getLong("id"), rs.getObject("family_id", UUID.class), rs.getLong("user_id"),
                            rs.getInt("credentials_version"), rs.getTimestamp("expires_at").toInstant(),
                            revoked == null ? null : revoked.toInstant());
                },
                hash).stream().findFirst();
    }

    public void revoke(long id, Instant at) {
        jdbc.update("UPDATE refresh_tokens SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL", Timestamp.from(at), id);
    }

    public void revokeFamily(UUID familyId, Instant at) {
        jdbc.update("UPDATE refresh_tokens SET revoked_at = ? WHERE family_id = ? AND revoked_at IS NULL", Timestamp.from(at), familyId);
    }

    /** Dọn token đã hết hạn của một người dùng khi cấp phiên mới, để bảng không phình mãi. */
    public void deleteExpired(long userId, Instant now) {
        jdbc.update("DELETE FROM refresh_tokens WHERE user_id = ? AND expires_at < ?", userId, Timestamp.from(now));
    }
}
