package com.aquaflow.auth.api;

import com.aquaflow.auth.api.dto.LoginRequest;
import com.aquaflow.auth.api.dto.LoginResponse;
import com.aquaflow.auth.api.dto.UserResponse;
import com.aquaflow.auth.application.AuthService;
import com.aquaflow.auth.application.InvalidCredentialsException;
import com.aquaflow.shared.api.ApiError;
import com.aquaflow.shared.api.RateLimiter;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Authentication", description = "Login and current-user endpoints")
public class AuthController {

    /**
     * Số lần đăng nhập sai tối đa từ một IP trong 15 phút. Chỉ tính lần sai, nên nhân viên
     * dùng chung mạng cửa hàng không bị chặn khi đăng nhập đúng. Không khóa theo email để
     * người khác không thể cố ý khóa tài khoản chủ cửa hàng.
     */
    static final int LOGIN_FAILURE_LIMIT = 20;

    private final AuthService authService;
    private final com.aquaflow.auth.application.CustomerRegistrationService registration;
    private final RateLimiter loginFailures;

    public AuthController(AuthService authService, com.aquaflow.auth.application.CustomerRegistrationService registration,
            Clock clock) {
        this.authService = authService;
        this.registration = registration;
        this.loginFailures = new RateLimiter(clock, Duration.ofMinutes(15), 10_000);
    }

    @PostMapping("/register")
    @org.springframework.web.bind.annotation.ResponseStatus(org.springframework.http.HttpStatus.CREATED)
    @Operation(summary = "Register a customer", description = "Creates an active CUSTOMER account and its own customer profile")
    public UserResponse register(@Valid @RequestBody com.aquaflow.auth.api.dto.RegisterRequest request) {
        return registration.register(request);
    }

    @PostMapping("/login")
    @Operation(summary = "Authenticate a user", description = "Returns a JWT bearer token for an active user")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Login successful", content = @Content(schema = @Schema(implementation = LoginResponse.class))),
            @ApiResponse(responseCode = "400", description = "Invalid request", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
            @ApiResponse(responseCode = "401", description = "Invalid credentials", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
            @ApiResponse(responseCode = "429", description = "Too many failed logins from this address", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError")))
    })
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request, HttpServletRequest http) {
        String key = "login:" + http.getRemoteAddr();
        if (loginFailures.isLimited(key, LOGIN_FAILURE_LIMIT)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .header("Retry-After", String.valueOf(loginFailures.windowSeconds()))
                    .body(new ApiError(Instant.now(), HttpStatus.TOO_MANY_REQUESTS.value(),
                            HttpStatus.TOO_MANY_REQUESTS.getReasonPhrase(),
                            "Bạn đã đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.",
                            http.getRequestURI()));
        }
        try {
            return ResponseEntity.ok(authService.login(request));
        } catch (InvalidCredentialsException exception) {
            loginFailures.record(key);
            throw exception;
        }
    }

    @GetMapping("/me")
    @Operation(summary = "Get the authenticated user")
    @SecurityRequirement(name = "bearerAuth")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Current user returned"),
            @ApiResponse(responseCode = "401", description = "Missing or invalid JWT", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError")))
    })
    public UserResponse me(Authentication authentication) {
        return authService.currentUser(authentication);
    }
}
