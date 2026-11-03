package com.aquaflow.delivery.api;

import com.aquaflow.auth.security.AuthUserDetails;
import com.aquaflow.delivery.api.DeliveryDtos.*;
import com.aquaflow.delivery.application.DeliveryService;
import com.aquaflow.shared.api.ApiError;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.time.Instant;
import java.util.List;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;

@RestController
@RequestMapping("/api/v1/delivery/trips")
@Tag(name = "Delivery trips")
@SecurityRequirement(name = "bearerAuth")
public class DeliveryController {
    private final DeliveryService service;

    public DeliveryController(DeliveryService service) { this.service = service; }

    @GetMapping
    public List<TripResponse> list(@AuthenticationPrincipal AuthUserDetails user, Authentication auth) {
        return service.list(user.user().getId(), canReadAll(auth));
    }

    @GetMapping("/{id}")
    public TripResponse get(@PathVariable long id, @AuthenticationPrincipal AuthUserDetails user,
                            Authentication auth) {
        return service.get(id, user.user().getId(), canReadAll(auth));
    }

    @PostMapping
    public ResponseEntity<TripResponse> create(@Valid @RequestBody CreateTripRequest request,
            @AuthenticationPrincipal AuthUserDetails user, Authentication auth) {
        TripResponse result = service.create(request, user.user().getId(), isAdmin(auth));
        return ResponseEntity.created(URI.create("/api/v1/delivery/trips/" + result.id())).body(result);
    }

    @PutMapping("/{id}/driver")
    public TripResponse assignDriver(@PathVariable long id, @Valid @RequestBody AssignDriverRequest request,
            @AuthenticationPrincipal AuthUserDetails user, Authentication auth) {
        return service.assignDriver(id, request, user.user().getId(), isAdmin(auth));
    }

    @PostMapping("/{id}/orders")
    public ResponseEntity<AssignmentResponse> addOrder(@PathVariable long id, @Valid @RequestBody AddOrderRequest request,
            @AuthenticationPrincipal AuthUserDetails user, Authentication auth) {
        var trip = service.addOrder(id, request, user.user().getId(), isAdmin(auth));
        var order = trip.orders().stream().filter(o -> o.orderId().equals(request.orderId())).findFirst().orElseThrow();
        return ResponseEntity.created(URI.create("/api/v1/delivery/trips/" + id + "/orders/" + request.orderId())).body(order);
    }

    @GetMapping("/{id}/orders/{orderId}")
    public AssignmentResponse order(@PathVariable long id, @PathVariable long orderId,
            @AuthenticationPrincipal AuthUserDetails user, Authentication auth) {
        return service.get(id, user.user().getId(), canReadAll(auth)).orders().stream()
                .filter(o -> o.orderId() == orderId).findFirst()
                .orElseThrow(() -> new com.aquaflow.shared.api.NotFoundException("Đơn không thuộc chuyến"));
    }

    @DeleteMapping("/{id}/orders/{orderId}")
    public TripResponse removeOrder(@PathVariable long id, @PathVariable long orderId,
            @AuthenticationPrincipal AuthUserDetails user, Authentication auth) {
        return service.removeOrder(id, orderId, user.user().getId(), isAdmin(auth));
    }

    @PutMapping("/{id}/departure")
    public TripResponse start(@PathVariable long id, @AuthenticationPrincipal AuthUserDetails user,
            Authentication auth) {
        return service.start(id, user.user().getId(), isAdmin(auth));
    }

    @PostMapping("/{id}/orders/{orderId}/attempts")
    public ResponseEntity<AttemptResponse> result(@PathVariable long id, @PathVariable long orderId,
            @Valid @RequestBody DeliveryResultRequest request,
            @AuthenticationPrincipal AuthUserDetails user, Authentication auth) {
        var trip = service.recordResult(id, orderId, request, user.user().getId(), isAdmin(auth));
        var attempt = trip.orders().stream().filter(o -> o.orderId() == orderId).findFirst().orElseThrow().latestAttempt();
        return ResponseEntity.created(URI.create("/api/v1/delivery/trips/" + id + "/orders/" + orderId + "/attempts/" + attempt.id()))
                .body(attempt);
    }

    @PutMapping("/{id}/settlement")
    public TripResponse settle(@PathVariable long id, @Valid @RequestBody SettleTripRequest request,
            @AuthenticationPrincipal AuthUserDetails user, Authentication auth) {
        return service.settle(id, request, user.user().getId(), isAdmin(auth));
    }

    @GetMapping("/{id}/orders/{orderId}/attempts")
    public List<AttemptResponse> attempts(@PathVariable long id, @PathVariable long orderId,
            @AuthenticationPrincipal AuthUserDetails user, Authentication auth) {
        return service.attempts(id, orderId, user.user().getId(), canReadAll(auth));
    }

    @GetMapping("/{id}/orders/{orderId}/attempts/{attemptId}")
    public AttemptResponse attempt(@PathVariable long id, @PathVariable long orderId, @PathVariable long attemptId,
            @AuthenticationPrincipal AuthUserDetails user, Authentication auth) {
        return attempts(id, orderId, user, auth).stream().filter(a -> a.id() == attemptId).findFirst()
                .orElseThrow(() -> new com.aquaflow.shared.api.NotFoundException("Không tìm thấy lần giao"));
    }

    @GetMapping("/{id}/settlement")
    public HandoverResponse settlement(@PathVariable long id, @AuthenticationPrincipal AuthUserDetails user, Authentication auth) {
        var result = service.get(id, user.user().getId(), canReadAll(auth)).settlement();
        if (result == null) throw new com.aquaflow.shared.api.NotFoundException("Chuyến chưa đối soát");
        return result;
    }

    @PatchMapping("/{id}")
    public TripResponse update(@PathVariable long id, @Valid @RequestBody UpdateTripRequest request,
            @AuthenticationPrincipal AuthUserDetails user, Authentication auth) {
        return service.cancel(id, user.user().getId(), isAdmin(auth));
    }

    private static boolean canReadAll(Authentication auth) {
        return auth.getAuthorities().stream().anyMatch(a ->
                "ROLE_ADMIN".equals(a.getAuthority()) || "ROLE_SALES_STAFF".equals(a.getAuthority()));
    }

    private static boolean isAdmin(Authentication auth) {
        return auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
    }

    // The project's GlobalExceptionHandler currently catches generic Exception as HTTP 500.
    // Handle delivery role-denials locally to ensure they respond with HTTP 403.
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiError> forbidden(AccessDeniedException error, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new ApiError(
                Instant.now(), 403, "Forbidden", error.getMessage(), request.getRequestURI()));
    }
}
