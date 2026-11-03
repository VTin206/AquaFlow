package com.aquaflow.customer.order.api;

import com.aquaflow.auth.security.AuthUserDetails;
import com.aquaflow.customer.order.api.dto.DispatchResponse;
import com.aquaflow.customer.order.application.OrderDispatchService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/v1/sales/orders/{orderId}/dispatches")
@Tag(name = "Dispatches", description = "Immutable full-order stock dispatch receipts")
@SecurityRequirement(name = "bearerAuth")
public class DispatchController {
    private final OrderDispatchService service;
    public DispatchController(OrderDispatchService service) { this.service = service; }

    @PostMapping
    @Operation(summary = "Create a full dispatch for a PREPARING order (ADMIN or SALES_STAFF)")
    public ResponseEntity<DispatchResponse> create(@PathVariable Long orderId,
                                                   @AuthenticationPrincipal AuthUserDetails principal) {
        var result = service.create(orderId, principal.user().getId());
        return ResponseEntity.created(URI.create("/api/v1/sales/orders/" + orderId + "/dispatches/" + result.id())).body(result);
    }

    @GetMapping
    @Operation(summary = "List dispatch receipts for an order")
    public List<DispatchResponse> list(@PathVariable Long orderId) { return service.list(orderId); }

    @GetMapping("/{dispatchId}")
    @Operation(summary = "Get a dispatch receipt by ID within its order")
    public DispatchResponse find(@PathVariable Long orderId, @PathVariable Long dispatchId) {
        return service.find(orderId, dispatchId);
    }
}
