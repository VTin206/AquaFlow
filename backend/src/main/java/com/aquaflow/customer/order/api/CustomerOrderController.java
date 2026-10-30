package com.aquaflow.customer.order.api;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.List;
import com.aquaflow.auth.security.AuthUserDetails;
import com.aquaflow.customer.api.dto.CustomerResponse;
import com.aquaflow.customer.application.CustomerService;
import com.aquaflow.customer.order.api.dto.OrderCreateRequest;
import com.aquaflow.customer.order.api.dto.OrderResponse;
import com.aquaflow.customer.order.api.dto.GuestOrderCreateRequest;
import com.aquaflow.customer.order.application.OrderService;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/customer/orders")
@Tag(name = "Customer Orders", description = "Online customer orders")
public class CustomerOrderController {

    private final OrderService orderService;
    private final CustomerService customerService;

    public CustomerOrderController(
            OrderService orderService,
            CustomerService customerService) {
        this.orderService = orderService;
        this.customerService = customerService;
    }

    @GetMapping
    @Operation(summary = "Get orders belonging to the current customer")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<List<OrderResponse>> findMyOrders(
            @AuthenticationPrincipal AuthUserDetails principal) {

        Long userId = principal.user().getId();

        return customerService.findActiveByUserId(userId)
                .map(customer -> ResponseEntity.ok(
                        orderService.findAllByCustomerId(customer.id())))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get an order belonging to the current customer")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<OrderResponse> findMyOrderById(
            @PathVariable Long id,
            @AuthenticationPrincipal AuthUserDetails principal) {

        Long userId = principal.user().getId();

        return customerService.findActiveByUserId(userId)
                .flatMap(customer ->
                        orderService.findByIdAndCustomerId(
                                id,
                                customer.id()))
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    @Operation(summary = "Create an online order")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<OrderResponse> create(
            @Valid @RequestBody OrderCreateRequest request,
            @AuthenticationPrincipal AuthUserDetails principal) {

        Long userId = principal.user().getId();

        CustomerResponse customer =
                customerService.findOrCreateForUser(
                        userId,
                        principal.user().getFullName(),
                        principal.user().getPhone());

        OrderResponse order = orderService.createForCustomer(
                request,
                customer.id(),
                userId);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(order);
    }

    @PostMapping("/guest")
    @Operation(summary = "Create a guest delivery order without authentication")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Guest order created", content =
                    @Content(mediaType = "application/json", schema = @Schema(implementation = OrderResponse.class))),
            @ApiResponse(responseCode = "400", description = "Invalid guest order request", content =
                    @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
            @ApiResponse(responseCode = "404", description = "Active product not found", content =
                    @Content(schema = @Schema(ref = "#/components/schemas/ApiError")))
    })
    public ResponseEntity<OrderResponse> createGuest(
            @Valid @RequestBody GuestOrderCreateRequest request) {

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(orderService.createForGuest(request));
    }
}
