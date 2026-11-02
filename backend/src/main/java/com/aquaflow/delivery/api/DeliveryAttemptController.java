package com.aquaflow.delivery.api;

import org.springframework.web.bind.annotation.GetMapping;
import java.util.List;
import com.aquaflow.auth.security.AuthUserDetails;
import com.aquaflow.delivery.api.dto.DeliveryAttemptCreateRequest;
import com.aquaflow.delivery.api.dto.DeliveryAttemptResponse;
import com.aquaflow.delivery.application.DeliveryAttemptWorkflowService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/delivery")
@Tag(
        name = "Delivery Attempts",
        description = "Record delivery attempt results"
)
@SecurityRequirement(name = "bearerAuth")
public class DeliveryAttemptController {

    private final DeliveryAttemptWorkflowService workflowService;

    public DeliveryAttemptController(
            DeliveryAttemptWorkflowService workflowService) {

        this.workflowService = workflowService;
    }

    @PostMapping("/assignments/{id}/attempts")
    @Operation(
            summary = "Record a delivery attempt",
            description = "Records SUCCESS or FAILED for an active "
                    + "delivery assignment"
    )
    public ResponseEntity<DeliveryAttemptResponse> recordAttempt(
            @PathVariable Long id,
            @Valid @RequestBody DeliveryAttemptCreateRequest request,
            @AuthenticationPrincipal AuthUserDetails principal) {

        Long viewerId = principal.user().getId();

        String viewerRole = principal.user()
                .getRole()
                .getCode();

        DeliveryAttemptResponse response =
                workflowService.recordAttempt(
                        id,
                        viewerId,
                        viewerRole,
                        request);

        return ResponseEntity.status(201).body(response);
    }
    
    @GetMapping("/orders/{orderId}/attempts")
    @Operation(
            summary = "Get delivery attempt history for an order",
            description = "Returns attempts across the original and all redelivery assignments"
    )
    public ResponseEntity<List<DeliveryAttemptResponse>> getOrderAttemptHistory(
            @PathVariable Long orderId,
            @AuthenticationPrincipal AuthUserDetails principal) {

        Long viewerId = principal.user().getId();
        String viewerRole = principal.user().getRole().getCode();

        return ResponseEntity.ok(
                workflowService.findOrderAttempts(
                        orderId,
                        viewerId,
                        viewerRole));
    }
}
