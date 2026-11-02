package com.aquaflow.delivery.application;

import com.aquaflow.customer.order.api.dto.OrderResponse;
import com.aquaflow.customer.order.application.OrderService;
import com.aquaflow.customer.order.domain.FulfillmentType;
import com.aquaflow.customer.order.domain.OrderStatus;
import com.aquaflow.delivery.application.port.DeliveryAssignmentAccessPort;
import com.aquaflow.delivery.application.port.DeliveryAssignmentSnapshot;
import com.aquaflow.delivery.domain.DeliveryAttempt;
import com.aquaflow.delivery.domain.DeliveryAttemptOutcome;
import com.aquaflow.delivery.repository.DeliveryAttemptRepository;
import com.aquaflow.delivery.repository.ReturnInspectionRepository;
import com.aquaflow.shared.api.ConflictException;
import com.aquaflow.shared.api.NotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import com.aquaflow.delivery.api.dto.DeliveryRedeliveryResponse;
import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

class RedeliveryWorkflowServiceTest {

    private DeliveryAttemptRepository attemptRepository;
    private ReturnInspectionRepository returnInspectionRepository;
    private DeliveryAssignmentAccessPort assignmentAccessPort;
    private OrderService orderService;

    private RedeliveryWorkflowService service;

    @BeforeEach
    void setUp() {
        attemptRepository = mock(DeliveryAttemptRepository.class);
        returnInspectionRepository = mock(ReturnInspectionRepository.class);
        assignmentAccessPort = mock(DeliveryAssignmentAccessPort.class);
        orderService = mock(OrderService.class);

        service = new RedeliveryWorkflowService(
                attemptRepository,
                returnInspectionRepository,
                assignmentAccessPort,
                orderService);
    }

    @Test
    void preparesRedeliveryWhenAllConditionsAreValid() {
        DeliveryAttempt attempt = failedAttempt();
        OrderResponse expectedOrder = preparingOrder();

        when(attemptRepository.findById(100L))
                .thenReturn(Optional.of(attempt));

        when(returnInspectionRepository.existsByAttemptId(100L))
                .thenReturn(true);

        when(assignmentAccessPort.findAssignment(
                10L, 7L, "SALES_STAFF"))
                .thenReturn(assignment(false));

        when(orderService.prepareForRedelivery(20L))
                .thenReturn(Optional.of(expectedOrder));

        when(assignmentAccessPort.createAssignment(55L, 20L))
                .thenReturn(new DeliveryAssignmentSnapshot(
                        99L,
                        20L,
                        FulfillmentType.DELIVERY,
                        OrderStatus.PREPARING,
                        true));

        DeliveryRedeliveryResponse result = service.prepareRedelivery(
                100L, 55L, 7L, "SALES_STAFF");

        assertEquals(20L, result.orderId());
        assertEquals(OrderStatus.PREPARING, result.orderStatus());
        assertEquals(55L, result.newTripId());
        assertEquals(99L, result.newAssignmentId());

        verify(orderService).prepareForRedelivery(20L);
        verify(assignmentAccessPort).createAssignment(55L, 20L);

        verify(orderService).prepareForRedelivery(20L);
    }

    @Test
    void rejectsRedeliveryWhenAttemptIsNotFailed() {
        when(attemptRepository.findById(100L))
                .thenReturn(Optional.of(
                        new DeliveryAttempt(
                                10L,
                                1,
                                DeliveryAttemptOutcome.SUCCESS,
                                "Customer",
                                null,
                                null,
                                null)));

        assertThrows(
                ConflictException.class,
                () -> service.prepareRedelivery(
                        100L, 55L, 7L, "SALES_STAFF"));

        verifyNoInteractions(
                returnInspectionRepository,
                assignmentAccessPort,
                orderService);
    }

    @Test
    void rejectsRedeliveryWithoutReturnInspection() {
        when(attemptRepository.findById(100L))
                .thenReturn(Optional.of(failedAttempt()));

        when(returnInspectionRepository.existsByAttemptId(100L))
                .thenReturn(false);

        assertThrows(
                ConflictException.class,
                () -> service.prepareRedelivery(
                        100L, 55L, 7L, "SALES_STAFF"));

        verifyNoInteractions(
                assignmentAccessPort,
                orderService);
    }

    @Test
    void rejectsRedeliveryWhenOldAssignmentIsStillActive() {
        when(attemptRepository.findById(100L))
                .thenReturn(Optional.of(failedAttempt()));

        when(returnInspectionRepository.existsByAttemptId(100L))
                .thenReturn(true);

        when(assignmentAccessPort.findAssignment(
                10L, 7L, "SALES_STAFF"))
                .thenReturn(assignment(true));

        assertThrows(
                ConflictException.class,
                () -> service.prepareRedelivery(
                        100L, 55L, 7L, "SALES_STAFF"));

        verifyNoInteractions(orderService);
    }

    @Test
    void rejectsRedeliveryWhenOrderIsNotOutForDelivery() {
        when(attemptRepository.findById(100L))
                .thenReturn(Optional.of(failedAttempt()));

        when(returnInspectionRepository.existsByAttemptId(100L))
                .thenReturn(true);

        when(assignmentAccessPort.findAssignment(
                10L, 7L, "SALES_STAFF"))
                .thenReturn(new DeliveryAssignmentSnapshot(
                        10L,
                        20L,
                        FulfillmentType.DELIVERY,
                        OrderStatus.PREPARING,
                        false));

        assertThrows(
                ConflictException.class,
                () -> service.prepareRedelivery(
                        100L, 55L, 7L, "SALES_STAFF"));

        verifyNoInteractions(orderService);
    }

    @Test
    void rejectsDeliveryStaffFromPreparingRedelivery() {
        assertThrows(
                NotFoundException.class,
                () -> service.prepareRedelivery(
                        100L, 55L, 7L, "DELIVERY_STAFF"));

        verifyNoInteractions(
                attemptRepository,
                returnInspectionRepository,
                assignmentAccessPort,
                orderService);
    }

    private DeliveryAttempt failedAttempt() {
        return new DeliveryAttempt(
                10L,
                1,
                DeliveryAttemptOutcome.FAILED,
                "Nguyen Van An",
                null,
                "Recipient unavailable",
                null);
    }

    private DeliveryAssignmentSnapshot assignment(boolean active) {
        return new DeliveryAssignmentSnapshot(
                10L,
                20L,
                FulfillmentType.DELIVERY,
                OrderStatus.OUT_FOR_DELIVERY,
                active);
    }

    private OrderResponse preparingOrder() {
        return new OrderResponse(
                20L,
                null,
                null,
                null,
                null,
                FulfillmentType.DELIVERY,
                OrderStatus.PREPARING,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                List.of());
    }

    @Test
    void rejectsWhenBe1ReturnsAssignmentForAnotherOrder() {

        when(attemptRepository.findById(100L))
                .thenReturn(Optional.of(failedAttempt()));

        when(returnInspectionRepository.existsByAttemptId(100L))
                .thenReturn(true);

        when(assignmentAccessPort.findAssignment(
                10L, 7L, "SALES_STAFF"))
                .thenReturn(assignment(false));

        when(orderService.prepareForRedelivery(20L))
                .thenReturn(Optional.of(preparingOrder()));

        when(assignmentAccessPort.createAssignment(55L, 20L))
                .thenReturn(new DeliveryAssignmentSnapshot(
                        98L,
                        21L,
                        FulfillmentType.DELIVERY,
                        OrderStatus.PREPARING,
                        true));

        assertThrows(
                ConflictException.class,
                () -> service.prepareRedelivery(
                        100L, 55L, 7L, "SALES_STAFF"));
    }
}
