package com.aquaflow.delivery.application;

import com.aquaflow.customer.order.api.dto.OrderResponse;
import com.aquaflow.customer.order.application.OrderService;
import com.aquaflow.customer.order.domain.OrderStatus;
import com.aquaflow.delivery.api.dto.DeliveryAttemptCreateRequest;
import com.aquaflow.delivery.api.dto.DeliveryAttemptResponse;
import com.aquaflow.delivery.domain.DeliveryAttempt;
import com.aquaflow.delivery.domain.DeliveryAttemptOutcome;
import com.aquaflow.delivery.repository.DeliveryAttemptRepository;
import com.aquaflow.delivery.repository.DeliveryLoadItemRepository;
import com.aquaflow.shared.api.BadRequestException;
import com.aquaflow.shared.api.ConflictException;
import com.aquaflow.shared.api.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class DeliveryAttemptService {

    private final DeliveryAttemptRepository deliveryAttemptRepository;
    private final DeliveryLoadItemRepository deliveryLoadItemRepository;
    private final OrderService orderService;

    public DeliveryAttemptService(
            DeliveryAttemptRepository deliveryAttemptRepository,
            DeliveryLoadItemRepository deliveryLoadItemRepository,
            OrderService orderService) {

        this.deliveryAttemptRepository = deliveryAttemptRepository;
        this.deliveryLoadItemRepository = deliveryLoadItemRepository;
        this.orderService = orderService;
    }

    @Transactional
    public DeliveryAttemptResponse recordAttemptAfterAssignmentValidation(
            Long assignmentId,
            Long orderId,
            DeliveryAttemptCreateRequest request) {

        validateRequest(assignmentId, orderId, request);

        if (deliveryAttemptRepository.existsByAssignmentId(assignmentId)) {
            throw new ConflictException(
                    "A delivery attempt has already been recorded "
                            + "for this assignment");
        }

        int attemptNo = deliveryAttemptRepository
            .findMaxAttemptNoByOrderId(orderId) + 1;

        if (request.outcome() == DeliveryAttemptOutcome.SUCCESS) {

            List<com.aquaflow.delivery.domain.DeliveryLoadItem> loadItems =
                    deliveryLoadItemRepository
                            .findAllByAssignmentIdOrderByOrderItemIdAscBatchIdAsc(
                                    assignmentId);

            if (loadItems.isEmpty()) {
                throw new ConflictException(
                        "Cannot complete delivery because no dispatched "
                                + "load items were found");
            }

            OrderResponse updatedOrder = orderService
                    .markDeliveredFromDeliveryWorkflow(orderId)
                    .orElseThrow(() -> new NotFoundException(
                            "Order not found: " + orderId));

            if (updatedOrder.status() != OrderStatus.DELIVERED) {
                throw new ConflictException(
                        "Order could not be marked as delivered");
            }

            for (com.aquaflow.delivery.domain.DeliveryLoadItem item : loadItems) {

                int remainingQuantity = item.getRemainingQuantity();

                if (remainingQuantity <= 0) {
                    throw new ConflictException(
                            "Load item has no remaining quantity to deliver");
                }

                item.recordDelivered(remainingQuantity);
            }

            deliveryLoadItemRepository.saveAll(loadItems);
        }

        DeliveryAttempt attempt = new DeliveryAttempt(
                assignmentId,
                attemptNo,
                request.outcome(),
                request.recipientName(),
                null,
                request.failureReason(),
                request.note());

        DeliveryAttempt savedAttempt =
                deliveryAttemptRepository.saveAndFlush(attempt);

        return toResponse(savedAttempt);
    }

    @Transactional(readOnly = true)
    public List<DeliveryAttemptResponse> findAllByAssignmentId(
            Long assignmentId) {

        if (assignmentId == null || assignmentId <= 0) {
            throw new BadRequestException(
                    "Assignment ID must be positive");
        }

        return deliveryAttemptRepository
                .findAllByAssignmentIdOrderByAttemptNoAsc(assignmentId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private void validateRequest(
            Long assignmentId,
            Long orderId,
            DeliveryAttemptCreateRequest request) {

        if (assignmentId == null || assignmentId <= 0) {
            throw new BadRequestException(
                    "Assignment ID must be positive");
        }

        if (orderId == null || orderId <= 0) {
            throw new BadRequestException(
                    "Order ID must be positive");
        }

        if (request == null || request.outcome() == null) {
            throw new BadRequestException(
                    "Delivery attempt outcome is required");
        }

        if (request.outcome() == DeliveryAttemptOutcome.FAILED
                && (request.failureReason() == null
                || request.failureReason().isBlank())) {

            throw new BadRequestException(
                    "Failure reason is required for failed delivery attempts");
        }

        if (request.outcome() == DeliveryAttemptOutcome.SUCCESS
                && request.failureReason() != null
                && !request.failureReason().isBlank()) {

            throw new BadRequestException(
                    "Successful delivery attempts cannot have a failure reason");
        }
    }

    private DeliveryAttemptResponse toResponse(DeliveryAttempt attempt) {

        return new DeliveryAttemptResponse(
                attempt.getId(),
                attempt.getAssignmentId(),
                attempt.getAttemptNo(),
                attempt.getOutcome(),
                attempt.getRecipientName(),
                attempt.getAttemptedAt(),
                attempt.getFailureReason(),
                attempt.getNote());
    }
}
