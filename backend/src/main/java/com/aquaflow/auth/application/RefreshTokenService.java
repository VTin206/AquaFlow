package com.aquaflow.auth.application;

import com.aquaflow.auth.domain.User;
import com.aquaflow.auth.repository.RefreshTokenRepository;
import com.aquaflow.auth.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;

/**
 * Refresh token xoay vòng: mỗi lần làm mới, token cũ bị thu hồi và cấp token mới cùng family.
 * Token đã thu hồi bị dùng lại sau thời gian cho phép nghĩa là có thể đã bị đánh cắp, nên thu hồi cả family.
 * Đổi/đặt lại mật khẩu hoặc khóa tài khoản làm tăng credentialsVersion, token cấp trước đó không dùng được nữa.
 */
@Service
public class RefreshTokenService {

    /**
     * Hai tab cùng làm mới gần như cùng lúc gửi cùng một token: tab chậm hơn bị từ chối nhưng không làm mất phiên,
     * vì cookie đã được tab kia thay bằng token mới. Quá khoảng này mới coi là dùng lại token bị lộ.
     */
    static final Duration REUSE_GRACE = Duration.ofSeconds(30);

    public record Rotated(User user, String token) {
    }

    private final RefreshTokenRepository tokens;
    private final UserRepository users;
    private final RefreshTokenProperties properties;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    public RefreshTokenService(RefreshTokenRepository tokens, UserRepository users, RefreshTokenProperties properties, Clock clock) {
        this.tokens = tokens;
        this.users = users;
        this.properties = properties;
        this.clock = clock;
    }

    public Duration lifetime() {
        return Duration.ofDays(properties.getDays());
    }

    /** Phiên đăng nhập mới: family mới. Trả token thật để đặt vào cookie; DB chỉ giữ bản băm. */
    @Transactional
    public String issue(User user) {
        Instant now = clock.instant();
        tokens.deleteExpired(user.getId(), now);
        return store(user, UUID.randomUUID(), now);
    }

    /** Đổi token cũ lấy token mới. Mọi trường hợp không hợp lệ đều ném {@link InvalidRefreshTokenException}. */
    @Transactional(noRollbackFor = InvalidRefreshTokenException.class)
    public Rotated rotate(String raw) {
        if (raw == null || raw.isBlank()) throw new InvalidRefreshTokenException();
        RefreshTokenRepository.Token token = tokens.lock(hash(raw)).orElseThrow(InvalidRefreshTokenException::new);
        Instant now = clock.instant();
        if (token.revoked()) {
            if (token.revokedAt().plus(REUSE_GRACE).isAfter(now)) throw new InvalidRefreshTokenException(false);
            tokens.revokeFamily(token.familyId(), now);
            throw new InvalidRefreshTokenException();
        }
        if (!token.expiresAt().isAfter(now)) {
            tokens.revoke(token.id(), now);
            throw new InvalidRefreshTokenException();
        }
        User user = users.findById(token.userId())
                .filter(User::isActive)
                .filter(current -> current.getCredentialsVersion() == token.credentialsVersion())
                .orElse(null);
        if (user == null) {
            tokens.revokeFamily(token.familyId(), now);
            throw new InvalidRefreshTokenException();
        }
        tokens.revoke(token.id(), now);
        return new Rotated(user, store(user, token.familyId(), now));
    }

    /** Đăng xuất: thu hồi cả family của token (mọi token đã xoay vòng từ lần đăng nhập đó). */
    @Transactional
    public void revoke(String raw) {
        if (raw == null || raw.isBlank()) return;
        tokens.lock(hash(raw)).ifPresent(token -> tokens.revokeFamily(token.familyId(), clock.instant()));
    }

    private String store(User user, UUID familyId, Instant now) {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        tokens.insert(hash(raw), familyId, user.getId(), user.getCredentialsVersion(), now, now.plus(lifetime()));
        return raw;
    }

    static String hash(String raw) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }
}
