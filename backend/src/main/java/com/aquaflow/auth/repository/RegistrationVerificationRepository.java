package com.aquaflow.auth.repository;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Optional;

/** Mã xác nhận email khi đăng ký, mỗi email (chữ thường) một dòng. */
@Repository
public class RegistrationVerificationRepository {
    public record Pending(String codeHash, int attempts, Instant sentAt, Instant expiresAt) {}

    private final JdbcTemplate jdbc;

    public RegistrationVerificationRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public Optional<Pending> lock(String email) {
        return jdbc.query("SELECT code_hash,attempts,sent_at,expires_at FROM registration_verifications WHERE email=? FOR UPDATE",
                (rs, n) -> new Pending(rs.getString(1), rs.getInt(2), rs.getTimestamp(3).toInstant(), rs.getTimestamp(4).toInstant()),
                email).stream().findFirst();
    }

    /** Thay mã cũ (nếu có) bằng mã mới và đặt lại số lần nhập sai. */
    public void replace(String email, String codeHash, Instant sentAt, Instant expiresAt) {
        jdbc.update("""
                INSERT INTO registration_verifications(email,code_hash,attempts,sent_at,expires_at) VALUES (?,?,0,?,?)
                ON CONFLICT (email) DO UPDATE SET code_hash=EXCLUDED.code_hash, attempts=0,
                    sent_at=EXCLUDED.sent_at, expires_at=EXCLUDED.expires_at""",
                email, codeHash, Timestamp.from(sentAt), Timestamp.from(expiresAt));
    }

    public void recordFailedAttempt(String email) {
        jdbc.update("UPDATE registration_verifications SET attempts=attempts+1 WHERE email=?", email);
    }

    public void delete(String email) {
        jdbc.update("DELETE FROM registration_verifications WHERE email=?", email);
    }

    /** Dọn mã đã hết hạn từ lâu mà khách bỏ dở, để bảng không phình ra. */
    public void deleteExpiredBefore(Instant before) {
        jdbc.update("DELETE FROM registration_verifications WHERE expires_at<?", Timestamp.from(before));
    }
}
