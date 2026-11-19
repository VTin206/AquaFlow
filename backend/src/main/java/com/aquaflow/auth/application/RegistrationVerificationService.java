package com.aquaflow.auth.application;

import com.aquaflow.auth.repository.RegistrationVerificationRepository;
import com.aquaflow.shared.api.BadRequestException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

/**
 * Mã 6 số xác nhận email khi khách tự đăng ký. Mã hết hạn sau 10 phút, nhập sai 5 lần thì phải xin mã mới,
 * và mỗi email chỉ được gửi lại sau 60 giây.
 */
@Service
public class RegistrationVerificationService {
    public static final Duration VALID_FOR = Duration.ofMinutes(10);
    public static final Duration RESEND_AFTER = Duration.ofSeconds(60);
    public static final int MAX_ATTEMPTS = 5;

    /** {@code waitSeconds > 0}: chưa gửi vì vừa gửi mã cho email này. */
    public record Sent(boolean required, long waitSeconds) {}

    private final RegistrationVerificationRepository repository;
    private final RegistrationMail mail;
    private final PasswordEncoder encoder;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    public RegistrationVerificationService(RegistrationVerificationRepository repository, RegistrationMail mail,
            PasswordEncoder encoder, Clock clock) {
        this.repository = repository; this.mail = mail; this.encoder = encoder; this.clock = clock;
    }

    public boolean required() { return mail.enabled(); }

    /** Gọi trong transaction: gửi mail lỗi thì mã mới bị rollback, mã cũ (nếu có) vẫn dùng được. */
    public Sent send(String email) {
        if (!required()) return new Sent(false, 0);
        Instant now = clock.instant();
        var pending = repository.lock(email);
        if (pending.isPresent()) {
            long wait = Duration.between(now, pending.get().sentAt().plus(RESEND_AFTER)).toSeconds();
            if (wait > 0) return new Sent(true, wait);
        }
        repository.deleteExpiredBefore(now.minus(Duration.ofDays(1)));
        String code = "%06d".formatted(random.nextInt(1_000_000));
        repository.replace(email, encoder.encode(code), now, now.plus(VALID_FOR));
        mail.send(email, code, VALID_FOR.toMinutes());
        return new Sent(true, 0);
    }

    /**
     * Kiểm tra và dùng mã trong transaction tạo tài khoản. Lần nhập sai được ghi lại nên transaction gọi hàm này
     * không được rollback khi gặp {@link BadRequestException} (xem {@code CustomerRegistrationService.register}).
     */
    public void consume(String email, String code) {
        if (!required()) return;
        if (code == null || code.isBlank()) throw new BadRequestException("Nhập mã xác nhận đã gửi tới email của bạn.");
        var pending = repository.lock(email)
                .filter(p -> p.expiresAt().isAfter(clock.instant()))
                .orElseThrow(() -> new BadRequestException("Mã xác nhận đã hết hạn. Bấm \"Gửi lại mã\" để nhận mã mới."));
        if (pending.attempts() >= MAX_ATTEMPTS)
            throw new BadRequestException("Bạn đã nhập sai quá " + MAX_ATTEMPTS + " lần. Bấm \"Gửi lại mã\" để nhận mã mới.");
        if (!encoder.matches(code, pending.codeHash())) {
            repository.recordFailedAttempt(email);
            int left = MAX_ATTEMPTS - pending.attempts() - 1;
            throw new BadRequestException(left > 0
                    ? "Mã xác nhận không đúng. Còn " + left + " lần thử."
                    : "Mã xác nhận không đúng. Bấm \"Gửi lại mã\" để nhận mã mới.");
        }
        repository.delete(email);
    }
}
