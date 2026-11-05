package com.aquaflow.delivery.api;

import com.aquaflow.auth.security.AuthUserDetails;
import com.aquaflow.customer.order.api.dto.DispatchResponse;
import com.aquaflow.delivery.api.DeliveryDtos.*;
import com.aquaflow.delivery.application.DeliveryAssignmentService;
import com.aquaflow.inventory.api.ReturnDtos;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/v1/delivery")
@io.swagger.v3.oas.annotations.tags.Tag(name = "Delivery assignments")
@io.swagger.v3.oas.annotations.security.SecurityRequirement(name = "bearerAuth")
public class DeliveryAssignmentController {
    private final DeliveryAssignmentService service;
    public DeliveryAssignmentController(DeliveryAssignmentService service) { this.service = service; }

    @PostMapping("/assignments/{id}/dispatch")
    public ResponseEntity<DispatchResponse> dispatch(@PathVariable long id,
            @AuthenticationPrincipal AuthUserDetails user, Authentication auth) {
        var receipt = service.dispatch(id, user.user().getId(), staff(auth));
        return ResponseEntity.created(URI.create("/api/v1/sales/orders/" + receipt.orderId() + "/dispatches/" + receipt.id())).body(receipt);
    }

    @PostMapping("/assignments/{id}/attempts")
    public ResponseEntity<AttemptResponse> record(@PathVariable long id, @Valid @RequestBody DeliveryResultRequest request,
            @AuthenticationPrincipal AuthUserDetails user, Authentication auth) {
        var result = service.record(id, request, user.user().getId(), staff(auth));
        return ResponseEntity.created(URI.create("/api/v1/delivery/assignments/" + id + "/attempts/" + result.id())).body(result);
    }

    @GetMapping("/assignments/{id}/attempts")
    public List<AttemptResponse> attempts(@PathVariable long id,
            @AuthenticationPrincipal AuthUserDetails user, Authentication auth) {
        return service.attempts(id, user.user().getId(), staff(auth));
    }

    @GetMapping("/assignments/{id}/attempts/{attemptId}")
    public AttemptResponse attempt(@PathVariable long id, @PathVariable long attemptId,
            @AuthenticationPrincipal AuthUserDetails user, Authentication auth) {
        return service.attempts(id, user.user().getId(), staff(auth)).stream().filter(a -> a.id() == attemptId).findFirst()
                .orElseThrow(() -> new com.aquaflow.shared.api.NotFoundException("Không tìm thấy lần giao"));
    }

    @PostMapping("/attempts/{id}/return-inspection")
    public ResponseEntity<ReturnDtos.Inspection> inspect(@PathVariable long id, @Valid @RequestBody ReturnDtos.AttemptInspection request,
            @AuthenticationPrincipal AuthUserDetails user, Authentication auth) {
        var result = service.inspect(id, request, user.user().getId(), staff(auth));
        return ResponseEntity.created(URI.create("/api/v1/inventory/returns/" + result.id())).body(result);
    }

    private boolean staff(Authentication auth) {
        return auth.getAuthorities().stream().anyMatch(a -> List.of("ROLE_ADMIN", "ROLE_SALES_STAFF").contains(a.getAuthority()));
    }
}
