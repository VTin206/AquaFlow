package com.aquaflow.delivery.application;

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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.util.List;

import java.time.OffsetDateTime;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class DeliveryAttemptWorkflowServiceTest {

    private DeliveryAssignmentAccessPort assignmentAccessPort;

    private DeliveryAttemptService deliveryAttemptService;

    private DeliveryAttemptWorkflowService workflowService;

    @BeforeEach
    void setUp() {
        assignmentAccessPort = mock(DeliveryAssignmentAccessPort.class);
        deliveryAttemptService = mock(DeliveryAttemptService.class);

        workflowService = new DeliveryAttemptWorkflowService(
                assignmentAccessPort,
                deliveryAttemptService);
    }

    @Test
    void successfulDeliveryRecordsAttemptAndDeactivatesAssignment() {
        DeliveryAttemptCreateRequest request = successRequest();

        DeliveryAttemptResponse expectedResponse =
                sampleResponse(DeliveryAttemptOutcome.SUCCESS);

        when(assignmentAccessPort.findActiveAssignment(
                10L, 7L, "DELIVERY_STAFF"))
                .thenReturn(assignment(
                        FulfillmentType.DELIVERY,
                        OrderStatus.OUT_FOR_DELIVERY,
                        true));

        when(deliveryAttemptService.recordAttemptAfterAssignmentValidation(
                10L, 20L, request))
                .thenReturn(expectedResponse);

        DeliveryAttemptResponse actualResponse =
                workflowService.recordAttempt(
                        10L, 7L, "DELIVERY_STAFF", request);

        assertSame(expectedResponse, actualResponse);

        verify(deliveryAttemptService)
                .recordAttemptAfterAssignmentValidation(
                        10L, 20L, request);

        verify(assignmentAccessPort)
                .deactivateAssignment(10L);
    }

    @Test
    void failedDeliveryRecordsAttemptWithoutDeactivatingAssignment() {
        DeliveryAttemptCreateRequest request = failedRequest();

        DeliveryAttemptResponse expectedResponse =
                sampleResponse(DeliveryAttemptOutcome.FAILED);

        when(assignmentAccessPort.findActiveAssignment(
                10L, 7L, "DELIVERY_STAFF"))
                .thenReturn(assignment(
                        FulfillmentType.DELIVERY,
                        OrderStatus.OUT_FOR_DELIVERY,
                        true));

        when(deliveryAttemptService.recordAttemptAfterAssignmentValidation(
                10L, 20L, request))
                .thenReturn(expectedResponse);

        DeliveryAttemptResponse actualResponse =
                workflowService.recordAttempt(
                        10L, 7L, "DELIVERY_STAFF", request);

        assertSame(expectedResponse, actualResponse);

        verify(deliveryAttemptService)
                .recordAttemptAfterAssignmentValidation(
                        10L, 20L, request);

        verify(assignmentAccessPort, never())
                .deactivateAssignment(10L);
    }

    @Test
    void throwsNotFoundWhenAssignmentDoesNotExist() {
        when(assignmentAccessPort.findActiveAssignment(
                10L, 7L, "DELIVERY_STAFF"))
                .thenReturn(null);

        assertThrows(
                NotFoundException.class,
                () -> workflowService.recordAttempt(
                        10L, 7L, "DELIVERY_STAFF", successRequest()));

        verifyNoInteractions(deliveryAttemptService);
    }

    @Test
    void throwsConflictWhenAssignmentIsInactive() {
        when(assignmentAccessPort.findActiveAssignment(
                10L, 7L, "DELIVERY_STAFF"))
                .thenReturn(assignment(
                        FulfillmentType.DELIVERY,
                        OrderStatus.OUT_FOR_DELIVERY,
                        false));

        assertThrows(
                ConflictException.class,
                () -> workflowService.recordAttempt(
                        10L, 7L, "DELIVERY_STAFF", successRequest()));

        verifyNoInteractions(deliveryAttemptService);
    }

    @Test
    void throwsConflictWhenAssignmentIsNotDeliveryFulfillment() {
        when(assignmentAccessPort.findActiveAssignment(
                10L, 7L, "DELIVERY_STAFF"))
                .thenReturn(assignment(
                        FulfillmentType.COUNTER,
                        OrderStatus.OUT_FOR_DELIVERY,
                        true));

        assertThrows(
                ConflictException.class,
                () -> workflowService.recordAttempt(
                        10L, 7L, "DELIVERY_STAFF", successRequest()));

        verifyNoInteractions(deliveryAttemptService);
    }

    @Test
    void throwsConflictWhenOrderIsNotOutForDelivery() {
        when(assignmentAccessPort.findActiveAssignment(
                10L, 7L, "DELIVERY_STAFF"))
                .thenReturn(assignment(
                        FulfillmentType.DELIVERY,
                        OrderStatus.PREPARING,
                        true));

        assertThrows(
                ConflictException.class,
                () -> workflowService.recordAttempt(
                        10L, 7L, "DELIVERY_STAFF", successRequest()));

        verifyNoInteractions(deliveryAttemptService);
    }

    @Test
    void throwsBadRequestWhenAssignmentIdIsInvalid() {
        assertThrows(
                BadRequestException.class,
                () -> workflowService.recordAttempt(
                        0L, 7L, "DELIVERY_STAFF", successRequest()));

        verifyNoInteractions(
                assignmentAccessPort,
                deliveryAttemptService);
    }

    @Test
    void throwsBadRequestWhenViewerIdIsInvalid() {
        assertThrows(
                BadRequestException.class,
                () -> workflowService.recordAttempt(
                        10L, null, "DELIVERY_STAFF", successRequest()));

        verifyNoInteractions(
                assignmentAccessPort,
                deliveryAttemptService);
    }

    @Test
    void returnsAttemptHistoryAcrossAllAssignmentsForTheSameOrder() {

        DeliveryAttemptResponse older = new DeliveryAttemptResponse(
                100L, 10L, 1, DeliveryAttemptOutcome.FAILED,
                "Recipient",
                OffsetDateTime.parse("2026-11-01T10:00:00Z"),
                "Recipient unavailable",
                null);

        DeliveryAttemptResponse newer = new DeliveryAttemptResponse(
                101L, 11L, 2, DeliveryAttemptOutcome.SUCCESS,
                "Recipient",
                OffsetDateTime.parse("2026-11-02T10:00:00Z"),
                null,
                null);

        when(assignmentAccessPort.findAssignmentsByOrderId(
                20L, 7L, "DELIVERY_STAFF"))
                .thenReturn(List.of(
                        new DeliveryAssignmentSnapshot(
                                11L, 20L,
                                FulfillmentType.DELIVERY,
                                OrderStatus.OUT_FOR_DELIVERY,
                                false),
                        new DeliveryAssignmentSnapshot(
                                10L, 20L,
                                FulfillmentType.DELIVERY,
                                OrderStatus.OUT_FOR_DELIVERY,
                                false)));

        when(deliveryAttemptService.findAllByAssignmentId(10L))
                .thenReturn(List.of(older));

        when(deliveryAttemptService.findAllByAssignmentId(11L))
                .thenReturn(List.of(newer));

        var history = workflowService.findOrderAttempts(
                20L, 7L, "DELIVERY_STAFF");

        org.assertj.core.api.Assertions.assertThat(history)
                .containsExactly(older, newer);
    }

    private DeliveryAssignmentSnapshot assignment(
            FulfillmentType fulfillmentType,
            OrderStatus orderStatus,
            boolean active) {

        return new DeliveryAssignmentSnapshot(
                10L,
                20L,
                fulfillmentType,
                orderStatus,
                active);
    }

    private DeliveryAttemptCreateRequest successRequest() {
        return new DeliveryAttemptCreateRequest(
                DeliveryAttemptOutcome.SUCCESS,
                "Nguyen Van An",
                null,
                "Successful delivery");
    }

    private DeliveryAttemptCreateRequest failedRequest() {
        return new DeliveryAttemptCreateRequest(
                DeliveryAttemptOutcome.FAILED,
                "Nguyen Van An",
                "Recipient could not be contacted",
                "Called recipient twice");
    }

    private DeliveryAttemptResponse sampleResponse(
            DeliveryAttemptOutcome outcome) {

        return new DeliveryAttemptResponse(
                100L,
                10L,
                1,
                outcome,
                "Nguyen Van An",
                OffsetDateTime.parse("2026-11-02T18:00:00+07:00"),
                outcome == DeliveryAttemptOutcome.FAILED
                        ? "Recipient could not be contacted"
                        : null,
                "Delivery attempt test");
    }
}
