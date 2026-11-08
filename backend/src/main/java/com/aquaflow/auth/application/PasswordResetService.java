package com.aquaflow.auth.application;

import com.aquaflow.auth.repository.PasswordResetRepository;
import com.aquaflow.shared.api.BadRequestException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.security.SecureRandom;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HexFormat;

@Service
public class PasswordResetService {
    private final PasswordResetRepository repository;
    private final PasswordResetMail mail;
    private final PasswordEncoder passwords;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();
    public PasswordResetService(PasswordResetRepository repository, PasswordResetMail mail, PasswordEncoder passwords, Clock clock) {
        this.repository = repository; this.mail = mail; this.passwords = passwords; this.clock = clock;
    }
    @Transactional
    public void request(String email) {
        var user = repository.lockEmail(email).filter(PasswordResetRepository.Account::active);
        if (user.isEmpty()) return;
        var now = clock.instant();
        if (repository.recentlyRequested(user.get().id(), now.minusSeconds(60))) return;
        byte[] bytes = new byte[32]; random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        repository.save(hash(token), user.get(), now);
        // SMTP failure rolls back the token replacement. Neither token nor SMTP error is logged.
        mail.send(user.get().email(), token);
    }
    @Transactional
    public void reset(String token, String password) {
        if (password.getBytes(StandardCharsets.UTF_8).length > 72)
            throw new BadRequestException("Mật khẩu không được vượt quá 72 byte UTF-8.");
        String hash = hash(token);
        var snapshot = repository.find(hash).orElseThrow(PasswordResetService::invalid);
        // Lock user first for both request and reset to prevent concurrent consumption/deadlocks.
        var user = repository.lockUser(snapshot.userId()).filter(PasswordResetRepository.Account::active)
                .orElseThrow(PasswordResetService::invalid);
        var reset = repository.find(hash).orElseThrow(PasswordResetService::invalid);
        if (!reset.expiresAt().isAfter(clock.instant()) || reset.version() != user.version()) throw invalid();
        repository.consume(user, passwords.encode(password));
    }
    private static BadRequestException invalid() {
        return new BadRequestException("Liên kết không hợp lệ, đã hết hạn hoặc đã được sử dụng. Vui lòng yêu cầu liên kết mới.");
    }
    public static String hash(String token) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8))); }
        catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
}
