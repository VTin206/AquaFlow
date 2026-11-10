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

import java.time.Clock;
import java.util.HashMap;
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
    private static final long WINDOW_MILLIS = 15 * 60 * 1000;
    private static final int MAX_KEYS = 10_000;

    private record Window(long until, int count) {
    }

    private final Map<String, Window> windows = new HashMap<>();
    private final OrderTrackingService service;
    private final Clock clock;

    public OrderTrackingController(OrderTrackingService service, Clock clock) {
        this.service = service;
        this.clock = clock;
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

    private synchronized boolean allow(String key, int limit) {
        long now = clock.millis();
        windows.entrySet().removeIf(entry -> entry.getValue().until() <= now);
        Window window = windows.get(key);
        if (window == null) {
            if (windows.size() >= MAX_KEYS) return false;
            windows.put(key, new Window(now + WINDOW_MILLIS, 1));
            return true;
        }
        if (window.count() >= limit) return false;
        windows.put(key, new Window(window.until(), window.count() + 1));
        return true;
    }

    private ResponseEntity<?> limited() {
        return ResponseEntity.status(429).header("Retry-After", "900")
                .body(Map.of("message", "Bạn đã tra cứu quá nhiều lần. Vui lòng thử lại sau 15 phút."));
    }
}
