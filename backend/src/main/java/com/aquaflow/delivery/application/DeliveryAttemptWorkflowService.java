package com.aquaflow.delivery.application;

import java.util.Comparator;
import java.util.List;
import com.aquaflow.customer.order.domain.FulfillmentType;
import com.aquaflow.customer.order.domain.OrderStatus;
import com.aquaflow.delivery.api.dto.DeliveryAttemptCreateRequest;
import com.aquaflow.delivery.api.dto.DeliveryAttemptResponse;
import com.aquaflow.delivery.application.port.DeliveryAssignmentAccessPort;
import com.aquaflow.delivery.application.port.DeliveryAssignmentSnapshot;
import com.aquaflow.delivery.domain.DeliveryAttemptOutcome;
import com.aquaflow.shared.api.BadRequestException;
import com.aquaflow.shared.api.ConflictException;
import com.aquaflow.shared.api.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DeliveryAttemptWorkflowService {

    private final DeliveryAssignmentAccessPort assignmentAccessPort;
    private final DeliveryAttemptService deliveryAttemptService;

    public DeliveryAttemptWorkflowService(
            DeliveryAssignmentAccessPort assignmentAccessPort,
            DeliveryAttemptService deliveryAttemptService) {

        this.assignmentAccessPort = assignmentAccessPort;
        this.deliveryAttemptService = deliveryAttemptService;
    }

    @Transactional
    public DeliveryAttemptResponse recordAttempt(
            Long assignmentId,
            Long viewerId,
            String viewerRole,
            DeliveryAttemptCreateRequest request) {

        validateInput(assignmentId, viewerId, viewerRole, request);

        DeliveryAssignmentSnapshot assignment =
                assignmentAccessPort.findActiveAssignment(
                        assignmentId,
                        viewerId,
                        viewerRole);

        if (assignment == null) {
            throw new NotFoundException(
                    "Active delivery assignment not found");
        }

        if (!assignment.active()) {
            throw new ConflictException(
                    "Delivery assignment is not active");
        }

        if (assignment.fulfillmentType() != FulfillmentType.DELIVERY) {
            throw new ConflictException(
                    "Assignment is not for delivery fulfillment");
        }

        if (assignment.orderId() == null) {
            throw new ConflictException(
                    "Delivery assignment has no associated order");
        }

        if (assignment.orderStatus() != OrderStatus.OUT_FOR_DELIVERY) {
            throw new ConflictException(
                    "Order must be OUT_FOR_DELIVERY before recording "
                            + "a delivery attempt");
        }

        DeliveryAttemptResponse response =
                deliveryAttemptService.recordAttemptAfterAssignmentValidation(
                        assignmentId,
                        assignment.orderId(),
                        request);

        if (request.outcome() == DeliveryAttemptOutcome.SUCCESS) {
            assignmentAccessPort.deactivateAssignment(assignmentId);
        }

        return response;
    }

    @Transactional(readOnly = true)
    public List<DeliveryAttemptResponse> findOrderAttempts(
            Long orderId,
            Long viewerId,
            String viewerRole) {

        validateHistoryInput(orderId, viewerId, viewerRole);

        List<DeliveryAssignmentSnapshot> assignments =
                assignmentAccessPort.findAssignmentsByOrderId(
                        orderId,
                        viewerId,
                        viewerRole);

        return assignments.stream()
                .flatMap(assignment -> deliveryAttemptService
                        .findAllByAssignmentId(assignment.assignmentId())
                        .stream())
                .sorted(Comparator
                        .comparing(DeliveryAttemptResponse::attemptedAt)
                        .thenComparing(DeliveryAttemptResponse::id))
                .toList();
    }

    private void validateHistoryInput(
            Long orderId,
            Long viewerId,
            String viewerRole) {

        if (orderId == null || orderId <= 0) {
            throw new BadRequestException("Order ID must be positive");
        }

        if (viewerId == null || viewerId <= 0) {
            throw new BadRequestException("Viewer ID must be positive");
        }

        if (viewerRole == null || viewerRole.isBlank()) {
            throw new BadRequestException("Viewer role is required");
        }
    }

    private void validateInput(
            Long assignmentId,
            Long viewerId,
            String viewerRole,
            DeliveryAttemptCreateRequest request) {

        if (assignmentId == null || assignmentId <= 0) {
            throw new BadRequestException(
                    "Assignment ID must be positive");
        }

        if (viewerId == null || viewerId <= 0) {
            throw new BadRequestException(
                    "Viewer ID must be positive");
        }

        if (viewerRole == null || viewerRole.isBlank()) {
            throw new BadRequestException(
                    "Viewer role is required");
        }

        if (request == null) {
            throw new BadRequestException(
                    "Delivery attempt request is required");
        }
    }
}
