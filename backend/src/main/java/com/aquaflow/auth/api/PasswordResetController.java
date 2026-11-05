package com.aquaflow.auth.api;

import com.aquaflow.auth.application.PasswordResetService;
import com.aquaflow.auth.application.PasswordResetMail;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.core.task.TaskRejectedException;
import java.util.Map;
import java.util.HashMap;
import java.time.Clock;

@RestController
@RequestMapping("/api/v1/auth")
public class PasswordResetController {
    public record Request(@NotBlank @Email @Size(max=150) String email) {
        public Request { if (email != null) email = email.trim().toLowerCase(java.util.Locale.ROOT); }
    }
    public record Reset(@NotBlank @Pattern(regexp="[A-Za-z0-9_-]{43}") String token,
                        @NotBlank @Size(min=8, max=128) String password) {}
    private record Window(long until, int count) {}
    private final Map<String, Window> windows = new HashMap<>();
    private final PasswordResetService service;
    private final PasswordResetMail mail;
    private final ThreadPoolTaskExecutor executor;
    private final Clock clock;
    public PasswordResetController(PasswordResetService service, PasswordResetMail mail,
            @Qualifier("passwordResetExecutor") ThreadPoolTaskExecutor executor, Clock clock) {
        this.service = service; this.mail = mail; this.executor = executor; this.clock = clock;
    }
    private synchronized boolean allow(String key, int limit) {
        long now = clock.millis();
        windows.entrySet().removeIf(entry -> entry.getValue().until() <= now);
        var window = windows.get(key);
        if (window == null) {
            if (windows.size() >= 10000) return false;
            windows.put(key, new Window(now + 900000, 1)); return true;
        }
        if (window.count() >= limit) return false;
        windows.put(key, new Window(window.until(), window.count()+1)); return true;
    }
    @PostMapping("/password-reset-requests")
    public ResponseEntity<?> request(@Valid @RequestBody Request body, HttpServletRequest request) {
        if (!allow("request:" + request.getRemoteAddr(), 5)) return limited();
        if (!mail.available()) return unavailable();
        try {
            executor.execute(() -> {
                try { service.request(body.email()); }
                catch (Exception ignored) {
                    org.slf4j.LoggerFactory.getLogger(getClass()).warn("Password reset email could not be processed; check SMTP configuration and database connectivity.");
                }
            });
        } catch (TaskRejectedException ignored) { return unavailable(); }
        return ResponseEntity.accepted().body(Map.of("message", "Nếu email thuộc tài khoản đang hoạt động, bạn sẽ nhận được liên kết đặt lại mật khẩu. Kiểm tra cả thư rác."));
    }
    @PostMapping("/password-resets")
    public ResponseEntity<?> reset(@Valid @RequestBody Reset body, HttpServletRequest request) {
        if (!allow("reset:" + request.getRemoteAddr(), 20)) return limited();
        service.reset(body.token(), body.password());
        return ResponseEntity.noContent().build();
    }
    private ResponseEntity<?> limited() {
        return ResponseEntity.status(429).header("Retry-After", "900").body(Map.of("message", "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau 15 phút."));
    }
    private ResponseEntity<?> unavailable() {
        return ResponseEntity.status(503).body(Map.of("message", "Dịch vụ gửi email khôi phục hiện chưa sẵn sàng. Vui lòng thử lại sau hoặc liên hệ cửa hàng."));
    }
}
