package com.aquaflow.delivery.application.adapter;

import com.aquaflow.customer.order.domain.FulfillmentType;
import com.aquaflow.customer.order.domain.OrderStatus;
import com.aquaflow.delivery.api.dto.DeliveryAssignmentResponse;
import com.aquaflow.delivery.api.dto.DeliveryTripResponse;
import com.aquaflow.delivery.application.DeliveryTripService;
import com.aquaflow.delivery.application.port.DeliveryAssignmentAccessPort;
import com.aquaflow.delivery.application.port.DeliveryAssignmentSnapshot;
import com.aquaflow.shared.api.NotFoundException;
import org.springframework.stereotype.Component;
import com.aquaflow.delivery.api.dto.CreateDeliveryAssignmentRequest;

import java.util.List;

@Component
public class Be1DeliveryAssignmentAccessAdapter
        implements DeliveryAssignmentAccessPort {

    private static final String DELIVERY_STAFF = "DELIVERY_STAFF";
    private static final String ADMIN = "ADMIN";
    private static final String SALES_STAFF = "SALES_STAFF";

    private final DeliveryTripService deliveryTripService;

    public Be1DeliveryAssignmentAccessAdapter(
            DeliveryTripService deliveryTripService) {

        this.deliveryTripService = deliveryTripService;
    }

    @Override
    public DeliveryAssignmentSnapshot findActiveAssignment(
            Long assignmentId,
            Long viewerId,
            String viewerRole) {

        List<DeliveryTripResponse> trips;

        if (DELIVERY_STAFF.equals(viewerRole)) {
            trips = deliveryTripService.findDriverTrips(
                    viewerId,
                    viewerRole);

        } else if (ADMIN.equals(viewerRole)
                || SALES_STAFF.equals(viewerRole)) {

            trips = deliveryTripService.findAll();

        } else {
            throw new NotFoundException(
                    "Delivery assignment not found");
        }

        return trips.stream()
                .filter(trip -> trip.assignments() != null)
                .flatMap(trip -> trip.assignments().stream())
                .filter(assignment ->
                        assignmentId.equals(assignment.id()))
                .findFirst()
                .map(this::toSnapshot)
                .orElseThrow(() -> new NotFoundException(
                        "Delivery assignment not found"));
    }

    @Override
    public DeliveryAssignmentSnapshot findAssignment(
            Long assignmentId,
            Long viewerId,
            String viewerRole) {

        if (!ADMIN.equals(viewerRole)
                && !SALES_STAFF.equals(viewerRole)) {
            throw new NotFoundException(
                    "Delivery assignment not found");
        }

        return deliveryTripService.findAll()
                .stream()
                .filter(trip -> trip.assignments() != null)
                .flatMap(trip -> trip.assignments().stream())
                .filter(assignment ->
                        assignmentId.equals(assignment.id()))
                .findFirst()
                .map(this::toSnapshot)
                .orElseThrow(() -> new NotFoundException(
                        "Delivery assignment not found"));
    }

    @Override
    public List<DeliveryAssignmentSnapshot> findAssignmentsByOrderId(
            Long orderId,
            Long viewerId,
            String viewerRole) {

        if (orderId == null || orderId <= 0
                || viewerId == null || viewerId <= 0) {
            throw new NotFoundException("Delivery order not found");
        }

        List<DeliveryTripResponse> trips;

        if (DELIVERY_STAFF.equals(viewerRole)) {

            List<DeliveryTripResponse> driverTrips =
                    deliveryTripService.findDriverTrips(viewerId, viewerRole);

            boolean assignedToOrder = driverTrips.stream()
                    .filter(trip -> trip.assignments() != null)
                    .flatMap(trip -> trip.assignments().stream())
                    .anyMatch(assignment ->
                            orderId.equals(assignment.orderId()));

            if (!assignedToOrder) {
                throw new NotFoundException("Delivery order not found");
            }

            trips = deliveryTripService.findAll();

        } else if (ADMIN.equals(viewerRole)
                || SALES_STAFF.equals(viewerRole)) {

            trips = deliveryTripService.findAll();

        } else {
            throw new NotFoundException("Delivery order not found");
        }

        return trips.stream()
                .filter(trip -> trip.assignments() != null)
                .flatMap(trip -> trip.assignments().stream())
                .filter(assignment ->
                        orderId.equals(assignment.orderId()))
                .map(this::toSnapshot)
                .toList();
    }

    @Override
    public DeliveryAssignmentSnapshot createAssignment(
            Long tripId,
            Long orderId) {

        DeliveryTripResponse updatedTrip =
                deliveryTripService.addAssignment(
                        tripId,
                        new CreateDeliveryAssignmentRequest(orderId));

        return updatedTrip.assignments().stream()
                .filter(assignment ->
                        orderId.equals(assignment.orderId())
                                && assignment.active())
                .findFirst()
                .map(this::toSnapshot)
                .orElseThrow(() -> new IllegalStateException(
                        "BE1 did not return the newly created delivery assignment"));
    }

    @Override
    public void deactivateAssignment(Long assignmentId) {
        deliveryTripService.deactivateAssignment(assignmentId);
    }

    private DeliveryAssignmentSnapshot toSnapshot(
            DeliveryAssignmentResponse assignment) {

        return new DeliveryAssignmentSnapshot(
                assignment.id(),
                assignment.orderId(),
                FulfillmentType.valueOf(
                        assignment.fulfillmentType()),
                OrderStatus.valueOf(
                        assignment.orderStatus()),
                assignment.active());
    }
}
