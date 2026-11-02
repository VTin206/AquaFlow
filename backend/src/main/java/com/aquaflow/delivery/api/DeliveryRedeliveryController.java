package com.aquaflow.delivery.api;

import com.aquaflow.auth.security.AuthUserDetails;
import com.aquaflow.delivery.api.dto.DeliveryRedeliveryRequest;
import com.aquaflow.delivery.api.dto.DeliveryRedeliveryResponse;
import com.aquaflow.delivery.application.RedeliveryWorkflowService;
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
@RequestMapping("/api/v1/delivery/attempts")
@Tag(
        name = "Delivery Redelivery",
        description = "Prepare a failed delivery and create its next assignment"
)
@SecurityRequirement(name = "bearerAuth")
public class DeliveryRedeliveryController {

    private final RedeliveryWorkflowService redeliveryWorkflowService;

    public DeliveryRedeliveryController(
            RedeliveryWorkflowService redeliveryWorkflowService) {

        this.redeliveryWorkflowService = redeliveryWorkflowService;
    }

    @PostMapping("/{attemptId}/redelivery")
    @Operation(
            summary = "Prepare order and create a new assignment for redelivery",
            description = "Requires completed return inspection and a CREATED trip"
    )
    public ResponseEntity<DeliveryRedeliveryResponse> prepareRedelivery(
            @PathVariable Long attemptId,
            @Valid @RequestBody DeliveryRedeliveryRequest request,
            @AuthenticationPrincipal AuthUserDetails principal) {

        Long viewerId = principal.user().getId();
        String viewerRole = principal.user().getRole().getCode();

        DeliveryRedeliveryResponse response =
                redeliveryWorkflowService.prepareRedelivery(
                        attemptId,
                        request.newTripId(),
                        viewerId,
                        viewerRole);

        return ResponseEntity.ok(response);
    }
}
