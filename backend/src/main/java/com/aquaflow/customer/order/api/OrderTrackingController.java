package com.aquaflow.customer.order.api;

import com.aquaflow.customer.order.api.dto.TrackingLookupRequest;
import com.aquaflow.customer.order.application.OrderTrackingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.aquaflow.shared.api.RateLimiter;

import java.time.Clock;
import java.time.Duration;
import java.util.Map;

/** API công khai (không cần đăng nhập) cho trang "Tra cứu đơn" của khách. */
@RestController
@RequestMapping("/api/v1/order-tracking")
@Tag(name = "Order Tracking", description = "Public order lookup for customers")
public class OrderTrackingController {

    /** Tra theo mã + số điện thoại: giới hạn chặt để không dò được số điện thoại. */
    static final int LOOKUP_LIMIT = 10;
    /** Trang theo dõi tự làm mới mỗi 20 giây, nên giới hạn rộng hơn. */
    static final int TOKEN_LIMIT = 240;

    private final OrderTrackingService service;
    private final RateLimiter limiter;

    public OrderTrackingController(OrderTrackingService service, Clock clock) {
        this.service = service;
        this.limiter = new RateLimiter(clock, Duration.ofMinutes(15), 10_000);
    }

    @PostMapping("/lookups")
    @Operation(summary = "Look up an order by order code and the phone number used to place it")
    public ResponseEntity<?> lookup(@Valid @RequestBody TrackingLookupRequest body, HttpServletRequest request) {
        if (!allow("lookup:" + request.getRemoteAddr(), LOOKUP_LIMIT)) return limited();
        return ResponseEntity.ok(service.lookup(body.orderCode(), body.phone()));
    }

    @GetMapping("/{token:[A-Za-z0-9_-]{16,64}}")
    @Operation(summary = "Get an order by its private tracking link")
    public ResponseEntity<?> byToken(@PathVariable String token, HttpServletRequest request) {
        if (!allow("token:" + request.getRemoteAddr(), TOKEN_LIMIT)) return limited();
        return ResponseEntity.ok(service.byToken(token));
    }

    private boolean allow(String key, int limit) {
        return limiter.tryAcquire(key, limit);
    }

    private ResponseEntity<?> limited() {
        return ResponseEntity.status(429).header("Retry-After", String.valueOf(limiter.windowSeconds()))
                .body(Map.of("message", "Bạn đã tra cứu quá nhiều lần. Vui lòng thử lại sau 15 phút."));
    }
}
