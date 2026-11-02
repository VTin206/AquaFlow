package com.aquaflow.delivery.api;

import com.aquaflow.auth.security.AuthUserDetails;
import com.aquaflow.delivery.api.dto.ReturnInspectionCreateRequest;
import com.aquaflow.delivery.api.dto.ReturnInspectionResponse;
import com.aquaflow.delivery.application.ReturnInspectionWorkflowService;
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
        name = "Return Inspections",
        description = "Inspect returned items after failed delivery"
)
@SecurityRequirement(name = "bearerAuth")
public class ReturnInspectionController {

    private final ReturnInspectionWorkflowService workflowService;

    public ReturnInspectionController(
            ReturnInspectionWorkflowService workflowService) {

        this.workflowService = workflowService;
    }

    @PostMapping("/attempts/{attemptId}/return-inspection")
    @Operation(
            summary = "Inspect returned items",
            description = "Records resellable and damaged quantities "
                    + "after a failed delivery attempt"
    )
    public ResponseEntity<ReturnInspectionResponse> inspectReturn(
            @PathVariable Long attemptId,
            @Valid @RequestBody ReturnInspectionCreateRequest request,
            @AuthenticationPrincipal AuthUserDetails principal) {

        Long viewerId = principal.user().getId();

        String viewerRole = principal.user()
                .getRole()
                .getCode();

        ReturnInspectionResponse response =
                workflowService.inspectReturn(
                        attemptId,
                        viewerId,
                        viewerRole,
                        request);

        return ResponseEntity.status(201).body(response);
    }
}
