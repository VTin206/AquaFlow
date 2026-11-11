package com.aquaflow.customer.order.api;

import com.aquaflow.auth.security.AuthUserDetails;
import com.aquaflow.customer.order.api.dto.OrderReturnDtos.Create;
import com.aquaflow.customer.order.api.dto.OrderReturnDtos.Response;
import com.aquaflow.customer.order.api.dto.OrderReturnDtos.Summary;
import com.aquaflow.customer.order.application.OrderReturnService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/sales/orders/{orderId}/returns")
@Tag(name = "Order returns")
@SecurityRequirement(name = "bearerAuth")
public class OrderReturnController {
    private final OrderReturnService service;

    public OrderReturnController(OrderReturnService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "Returns of an order and how many of each line can still be returned")
    public Summary list(@PathVariable long orderId) {
        return service.summary(orderId);
    }

    @PostMapping
    @Operation(summary = "Take back goods from a delivered order (ADMIN)",
            description = "Reduces what the order is worth; refunds any overpayment in the same request (refund required then). "
                    + "restock=true puts goods back into the lots the customer received. Idempotent by requestId.")
    public ResponseEntity<Response> create(@PathVariable Long orderId, @Valid @RequestBody Create request,
                                           @AuthenticationPrincipal AuthUserDetails principal) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.receive(orderId, principal.user().getId(), request));
    }
}
