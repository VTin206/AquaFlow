package com.aquaflow.delivery.api;

import com.aquaflow.auth.security.AuthUserDetails;
import com.aquaflow.delivery.api.dto.DeliveryDispatchResponse;
import com.aquaflow.delivery.application.DeliveryDispatchService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/delivery")
@Tag(
        name = "Delivery Dispatch",
        description = "Dispatch reserved inventory for delivery assignments"
)
@SecurityRequirement(name = "bearerAuth")
public class DeliveryDispatchController {

    private final DeliveryDispatchService deliveryDispatchService;

    public DeliveryDispatchController(
            DeliveryDispatchService deliveryDispatchService) {

        this.deliveryDispatchService = deliveryDispatchService;
    }

    @PostMapping("/assignments/{id}/dispatch")
    @Operation(
            summary = "Dispatch inventory for a delivery assignment",
            description = "Dispatches all reserved order items and changes "
                    + "the order status to OUT_FOR_DELIVERY"
    )
    public ResponseEntity<DeliveryDispatchResponse> dispatch(
            @PathVariable Long id,
            @AuthenticationPrincipal AuthUserDetails principal) {

        Long viewerId = principal.user().getId();

        String viewerRole = principal.user()
                .getRole()
                .getCode();

        DeliveryDispatchResponse response =
                deliveryDispatchService.dispatch(
                        id,
                        viewerId,
                        viewerRole);

        return ResponseEntity.ok(response);
    }
}
