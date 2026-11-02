package com.aquaflow.delivery.api;

import com.aquaflow.auth.security.AuthUserDetails;
import com.aquaflow.delivery.api.dto.CreateDeliveryAssignmentRequest;
import com.aquaflow.delivery.api.dto.CreateDeliveryTripRequest;
import com.aquaflow.delivery.api.dto.DeliveryTripResponse;
import com.aquaflow.delivery.api.dto.UpdateDeliveryTripRequest;
import com.aquaflow.delivery.application.DeliveryTripService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/delivery")
@Tag(name = "Delivery Trips", description = "Internal delivery trip and assignment management")
@SecurityRequirement(name = "bearerAuth")
public class DeliveryTripController {

    private final DeliveryTripService deliveryTripService;

    public DeliveryTripController(DeliveryTripService deliveryTripService) {
        this.deliveryTripService = deliveryTripService;
    }

    @PostMapping("/trips")
    @Operation(summary = "Create a delivery trip and assign a delivery staff member")
    public ResponseEntity<DeliveryTripResponse> create(
            @Valid @RequestBody CreateDeliveryTripRequest request,
            @AuthenticationPrincipal AuthUserDetails principal) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(deliveryTripService.create(request, principal.user().getId()));
    }

    @GetMapping("/trips")
    @Operation(summary = "List delivery trips for administrators and sales staff")
    public List<DeliveryTripResponse> findAll() {
        return deliveryTripService.findAll();
    }

    @GetMapping("/trips/{id}")
    @Operation(summary = "Get a trip; delivery staff can only access their own trip")
    public DeliveryTripResponse findById(
            @PathVariable Long id,
            @AuthenticationPrincipal AuthUserDetails principal) {
        return deliveryTripService.findById(
                id,
                principal.user().getId(),
                principal.user().getRole().getCode());
    }

    @PatchMapping("/trips/{id}")
    @Operation(summary = "Change the driver of an unassigned CREATED trip")
    public DeliveryTripResponse update(
            @PathVariable Long id,
            @Valid @RequestBody UpdateDeliveryTripRequest request) {
        return deliveryTripService.update(id, request);
    }

    @PostMapping("/trips/{id}/assignments")
    @Operation(summary = "Assign a PREPARING delivery order to a trip")
    public ResponseEntity<DeliveryTripResponse> addAssignment(
            @PathVariable Long id,
            @Valid @RequestBody CreateDeliveryAssignmentRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(deliveryTripService.addAssignment(id, request));
    }

    @GetMapping("/driver/trips")
    @Operation(summary = "List trips assigned to the authenticated delivery staff member")
    public List<DeliveryTripResponse> findDriverTrips(
            @AuthenticationPrincipal AuthUserDetails principal) {
        return deliveryTripService.findDriverTrips(
                principal.user().getId(),
                principal.user().getRole().getCode());
    }
}
