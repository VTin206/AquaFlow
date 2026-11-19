package com.aquaflow.auth.api;

import com.aquaflow.auth.api.dto.RegisterCodeRequest;
import com.aquaflow.auth.application.CustomerRegistrationService;
import com.aquaflow.auth.application.RegistrationVerificationService;
import com.aquaflow.shared.api.RateLimiter;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.mail.MailException;
import org.springframework.web.bind.annotation.*;
import java.time.Clock;
import java.time.Duration;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth/register")
@Tag(name = "Authentication")
public class RegistrationCodeController {
    /** Số lần xin mã từ một IP trong 15 phút, để không ai dùng form đăng ký gửi mail hàng loạt. */
    static final int CODE_REQUEST_LIMIT = 10;

    private final CustomerRegistrationService registration;
    private final RateLimiter limiter;

    public RegistrationCodeController(CustomerRegistrationService registration, Clock clock) {
        this.registration = registration;
        this.limiter = new RateLimiter(clock, Duration.ofMinutes(15), 10_000);
    }

    @PostMapping("/verification-codes")
    @Operation(summary = "Send the registration email code",
            description = "Checks that email and phone are free, then mails a 6-digit code (valid 10 minutes). "
                    + "When email verification is off, returns required=false and sends nothing.")
    public ResponseEntity<?> send(@Valid @RequestBody RegisterCodeRequest body, HttpServletRequest request) {
        if (!limiter.tryAcquire("register-code:" + request.getRemoteAddr(), CODE_REQUEST_LIMIT))
            return ResponseEntity.status(429).header("Retry-After", "900")
                    .body(Map.of("message", "Bạn đã xin mã quá nhiều lần. Vui lòng thử lại sau 15 phút."));
        RegistrationVerificationService.Sent sent;
        try {
            sent = registration.sendVerificationCode(body.email(), body.phone());
        } catch (MailException failure) {
            // Không ghi chi tiết lỗi SMTP (có thể chứa địa chỉ email của khách).
            LoggerFactory.getLogger(getClass()).warn("Registration code email could not be sent; check SMTP configuration.");
            return ResponseEntity.status(503).body(Map.of("message",
                    "Không gửi được email xác nhận. Kiểm tra lại địa chỉ email hoặc thử lại sau."));
        }
        if (sent.waitSeconds() > 0)
            return ResponseEntity.status(429).header("Retry-After", String.valueOf(sent.waitSeconds()))
                    .body(Map.of("message", "Mã vừa được gửi. Vui lòng đợi " + sent.waitSeconds() + " giây rồi gửi lại.",
                            "retryAfterSeconds", sent.waitSeconds()));
        return ResponseEntity.accepted().body(Map.of(
                "required", sent.required(),
                "expiresInSeconds", RegistrationVerificationService.VALID_FOR.toSeconds(),
                "resendAfterSeconds", RegistrationVerificationService.RESEND_AFTER.toSeconds()));
    }
}
