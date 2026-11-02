package com.aquaflow.delivery.application;

import com.aquaflow.customer.order.api.dto.OrderResponse;
import com.aquaflow.customer.order.application.OrderService;
import com.aquaflow.customer.order.domain.FulfillmentType;
import com.aquaflow.customer.order.domain.OrderStatus;
import com.aquaflow.delivery.api.dto.DeliveryRedeliveryResponse;
import com.aquaflow.delivery.application.port.DeliveryAssignmentAccessPort;
import com.aquaflow.delivery.application.port.DeliveryAssignmentSnapshot;
import com.aquaflow.delivery.domain.DeliveryAttempt;
import com.aquaflow.delivery.domain.DeliveryAttemptOutcome;
import com.aquaflow.delivery.repository.DeliveryAttemptRepository;
import com.aquaflow.delivery.repository.ReturnInspectionRepository;
import com.aquaflow.shared.api.BadRequestException;
import com.aquaflow.shared.api.ConflictException;
import com.aquaflow.shared.api.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RedeliveryWorkflowService {

    private static final String ADMIN = "ADMIN";
    private static final String SALES_STAFF = "SALES_STAFF";

    private final DeliveryAttemptRepository attemptRepository;
    private final ReturnInspectionRepository returnInspectionRepository;
    private final DeliveryAssignmentAccessPort assignmentAccessPort;
    private final OrderService orderService;

    public RedeliveryWorkflowService(
            DeliveryAttemptRepository attemptRepository,
            ReturnInspectionRepository returnInspectionRepository,
            DeliveryAssignmentAccessPort assignmentAccessPort,
            OrderService orderService) {

        this.attemptRepository = attemptRepository;
        this.returnInspectionRepository = returnInspectionRepository;
        this.assignmentAccessPort = assignmentAccessPort;
        this.orderService = orderService;
    }

    @Transactional
    public DeliveryRedeliveryResponse prepareRedelivery(
            Long attemptId,
            Long newTripId,
            Long viewerId,
            String viewerRole) {

        validatePositive(attemptId, "Attempt ID");
        validatePositive(newTripId, "New delivery trip ID");
        validatePositive(viewerId, "Viewer ID");

        if (!ADMIN.equals(viewerRole)
                && !SALES_STAFF.equals(viewerRole)) {
            throw new NotFoundException("Delivery attempt not found");
        }

        DeliveryAttempt attempt = attemptRepository.findById(attemptId)
                .orElseThrow(() -> new NotFoundException(
                        "Delivery attempt not found: " + attemptId));

        if (attempt.getOutcome() != DeliveryAttemptOutcome.FAILED) {
            throw new ConflictException(
                    "Only failed delivery attempts can be retried");
        }

        if (!returnInspectionRepository.existsByAttemptId(attemptId)) {
            throw new ConflictException(
                    "Return inspection must be completed before redelivery");
        }

        DeliveryAssignmentSnapshot previousAssignment =
                assignmentAccessPort.findAssignment(
                        attempt.getAssignmentId(),
                        viewerId,
                        viewerRole);

        if (previousAssignment.active()) {
            throw new ConflictException(
                    "Previous assignment must be inactive before redelivery");
        }

        if (previousAssignment.fulfillmentType() != FulfillmentType.DELIVERY
                || previousAssignment.orderId() == null) {
            throw new ConflictException("Invalid delivery assignment");
        }

        if (previousAssignment.orderStatus() != OrderStatus.OUT_FOR_DELIVERY) {
            throw new ConflictException(
                    "Order is not eligible for redelivery");
        }

        OrderResponse preparedOrder = orderService
                .prepareForRedelivery(previousAssignment.orderId())
                .orElseThrow(() -> new NotFoundException(
                        "Order not found: " + previousAssignment.orderId()));

        if (preparedOrder.status() != OrderStatus.PREPARING) {
            throw new ConflictException(
                    "Order could not be prepared for redelivery");
        }

        DeliveryAssignmentSnapshot newAssignment =
                assignmentAccessPort.createAssignment(
                        newTripId,
                        preparedOrder.id());

        if (newAssignment == null
                || newAssignment.assignmentId() == null
                || !newAssignment.active()
                || !preparedOrder.id().equals(newAssignment.orderId())
                || newAssignment.fulfillmentType() != FulfillmentType.DELIVERY
                || newAssignment.orderStatus() != OrderStatus.PREPARING) {

            throw new ConflictException(
                    "A new active delivery assignment could not be created");
        }

        return new DeliveryRedeliveryResponse(
                attemptId,
                preparedOrder.id(),
                preparedOrder.status(),
                newTripId,
                newAssignment.assignmentId());
    }

    private void validatePositive(Long value, String fieldName) {
        if (value == null || value <= 0) {
            throw new BadRequestException(fieldName + " must be positive");
        }
    }
}
