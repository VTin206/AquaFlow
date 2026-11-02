package com.aquaflow.delivery.application;

import com.aquaflow.customer.order.api.dto.OrderResponse;
import com.aquaflow.customer.order.application.OrderService;
import com.aquaflow.customer.order.domain.FulfillmentType;
import com.aquaflow.customer.order.domain.OrderChannel;
import com.aquaflow.customer.order.domain.OrderStatus;
import com.aquaflow.customer.order.domain.PaymentStatus;
import com.aquaflow.delivery.api.dto.ReturnInspectionCreateRequest;
import com.aquaflow.delivery.api.dto.ReturnInspectionResponse;
import com.aquaflow.delivery.application.port.DeliveryAssignmentAccessPort;
import com.aquaflow.delivery.application.port.DeliveryAssignmentSnapshot;
import com.aquaflow.delivery.application.port.InventoryReturnPort;
import com.aquaflow.delivery.application.port.ReturnStockLine;
import com.aquaflow.delivery.domain.DeliveryAttempt;
import com.aquaflow.delivery.domain.DeliveryAttemptOutcome;
import com.aquaflow.delivery.domain.DeliveryLoadItem;
import com.aquaflow.delivery.domain.ReturnInspection;
import com.aquaflow.delivery.repository.DeliveryAttemptRepository;
import com.aquaflow.delivery.repository.DeliveryLoadItemRepository;
import com.aquaflow.delivery.repository.ReturnInspectionLineRepository;
import com.aquaflow.delivery.repository.ReturnInspectionRepository;
import com.aquaflow.shared.api.BadRequestException;
import com.aquaflow.shared.api.ConflictException;
import com.aquaflow.shared.api.NotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReturnInspectionWorkflowServiceTest {

    @Mock
    private DeliveryAttemptRepository deliveryAttemptRepository;

    @Mock
    private ReturnInspectionRepository returnInspectionRepository;

    @Mock
    private ReturnInspectionLineRepository returnInspectionLineRepository;

    @Mock
    private DeliveryLoadItemRepository deliveryLoadItemRepository;

    @Mock
    private DeliveryAssignmentAccessPort assignmentAccessPort;

    @Mock
    private InventoryReturnPort inventoryReturnPort;

    @Mock
    private OrderService orderService;

    private ReturnInspectionWorkflowService workflowService;

    @BeforeEach
    void setUp() {
        workflowService = new ReturnInspectionWorkflowService(
                deliveryAttemptRepository,
                returnInspectionRepository,
                returnInspectionLineRepository,
                deliveryLoadItemRepository,
                assignmentAccessPort,
                inventoryReturnPort,
                orderService);
    }

    @Test
    void successfullyInspectsReturnedItemsAndDeactivatesAssignment() {

        DeliveryLoadItem item = loadItem(300L, 200L, 5);

        stubValidAttemptAndAssignment();

        when(orderService.findForUpdateById(100L))
                .thenReturn(Optional.of(
                        sampleOrder(OrderStatus.OUT_FOR_DELIVERY)));

        when(deliveryLoadItemRepository
                .findAllByAssignmentIdOrderByOrderItemIdAscBatchIdAsc(10L))
                .thenReturn(List.of(item));

        when(returnInspectionRepository.saveAndFlush(
                any(ReturnInspection.class)))
                .thenAnswer(invocation -> {
                    ReturnInspection inspection =
                            invocation.getArgument(0);

                    ReflectionTestUtils.setField(
                            inspection,
                            "id",
                            500L);

                    return inspection;
                });

        when(returnInspectionLineRepository.saveAll(any()))
                .thenAnswer(invocation -> invocation.getArgument(0));

        ReturnInspectionCreateRequest request = request(
                line(300L, 3, 2));

        ReturnInspectionResponse response =
                workflowService.inspectReturn(
                        100L,
                        7L,
                        "DELIVERY_STAFF",
                        request);

        assertThat(response.id()).isEqualTo(500L);
        assertThat(response.attemptId()).isEqualTo(100L);
        assertThat(response.assignmentId()).isEqualTo(10L);
        assertThat(response.inspectedBy()).isEqualTo(7L);
        assertThat(response.lines()).hasSize(1);

        assertThat(item.getQuantityReturned()).isEqualTo(5);
        assertThat(item.getRemainingQuantity()).isZero();

        verify(inventoryReturnPort).receiveReturn(
                100L,
                List.of(new ReturnStockLine(200L, 300L, 3, 2)),
                "Return inspection test",
                7L);

        verify(returnInspectionRepository)
                .saveAndFlush(any(ReturnInspection.class));

        verify(returnInspectionLineRepository)
                .saveAll(any());

        verify(deliveryLoadItemRepository)
                .saveAll(List.of(item));

        verify(assignmentAccessPort)
                .deactivateAssignment(10L);
    }

    @Test
    void throwsNotFoundWhenAttemptDoesNotExist() {

        when(deliveryAttemptRepository.findById(100L))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() ->
                workflowService.inspectReturn(
                        100L,
                        7L,
                        "DELIVERY_STAFF",
                        request(line(300L, 3, 2))))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("Delivery attempt not found: 100");

        verifyNoInteractions(
                returnInspectionRepository,
                returnInspectionLineRepository,
                deliveryLoadItemRepository,
                assignmentAccessPort,
                inventoryReturnPort,
                orderService);
    }

    @Test
    void rejectsReturnInspectionForSuccessfulAttempt() {

        when(deliveryAttemptRepository.findById(100L))
                .thenReturn(Optional.of(
                        attempt(DeliveryAttemptOutcome.SUCCESS)));

        assertThatThrownBy(() ->
                workflowService.inspectReturn(
                        100L,
                        7L,
                        "DELIVERY_STAFF",
                        request(line(300L, 3, 2))))
                .isInstanceOf(ConflictException.class)
                .hasMessage(
                        "Return inspection is only allowed for failed delivery attempts");

        verifyNoInteractions(
                returnInspectionRepository,
                returnInspectionLineRepository,
                deliveryLoadItemRepository,
                assignmentAccessPort,
                inventoryReturnPort,
                orderService);
    }

    @Test
    void rejectsDuplicateReturnInspectionForSameAttempt() {

        when(deliveryAttemptRepository.findById(100L))
                .thenReturn(Optional.of(
                        attempt(DeliveryAttemptOutcome.FAILED)));

        when(returnInspectionRepository.existsByAttemptId(100L))
                .thenReturn(true);

        assertThatThrownBy(() ->
                workflowService.inspectReturn(
                        100L,
                        7L,
                        "DELIVERY_STAFF",
                        request(line(300L, 3, 2))))
                .isInstanceOf(ConflictException.class)
                .hasMessage(
                        "Return inspection already exists for this attempt");

        verifyNoInteractions(
                assignmentAccessPort,
                deliveryLoadItemRepository,
                inventoryReturnPort,
                orderService);
    }

    @Test
    void rejectsInactiveAssignment() {

        when(deliveryAttemptRepository.findById(100L))
                .thenReturn(Optional.of(
                        attempt(DeliveryAttemptOutcome.FAILED)));

        when(returnInspectionRepository.existsByAttemptId(100L))
                .thenReturn(false);

        when(assignmentAccessPort.findActiveAssignment(
                10L, 7L, "DELIVERY_STAFF"))
                .thenReturn(assignment(false));

        assertThatThrownBy(() ->
                workflowService.inspectReturn(
                        100L,
                        7L,
                        "DELIVERY_STAFF",
                        request(line(300L, 3, 2))))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("Active delivery assignment not found");

        verifyNoInteractions(
                deliveryLoadItemRepository,
                inventoryReturnPort,
                orderService);
    }

    @Test
    void rejectsOrderThatIsNotOutForDelivery() {

        stubValidAttemptAndAssignment();

        when(orderService.findForUpdateById(100L))
                .thenReturn(Optional.of(
                        sampleOrder(OrderStatus.PREPARING)));

        assertThatThrownBy(() ->
                workflowService.inspectReturn(
                        100L,
                        7L,
                        "DELIVERY_STAFF",
                        request(line(300L, 3, 2))))
                .isInstanceOf(ConflictException.class)
                .hasMessage(
                        "Order must be OUT_FOR_DELIVERY during return inspection");

        verifyNoInteractions(deliveryLoadItemRepository);

        verifyNoInteractions(
                inventoryReturnPort,
                returnInspectionLineRepository);
    }

    @Test
    void rejectsWhenNoDispatchedLoadItemsExist() {

        stubValidAttemptAndAssignment();

        when(orderService.findForUpdateById(100L))
                .thenReturn(Optional.of(
                        sampleOrder(OrderStatus.OUT_FOR_DELIVERY)));

        when(deliveryLoadItemRepository
                .findAllByAssignmentIdOrderByOrderItemIdAscBatchIdAsc(10L))
                .thenReturn(List.of());

        assertThatThrownBy(() ->
                workflowService.inspectReturn(
                        100L,
                        7L,
                        "DELIVERY_STAFF",
                        request(line(300L, 3, 2))))
                .isInstanceOf(ConflictException.class)
                .hasMessage("No dispatched load items were found");

        verifyNoInteractions(
                inventoryReturnPort,
                returnInspectionLineRepository);

        verify(assignmentAccessPort, never())
                .deactivateAssignment(10L);
    }

    @Test
    void rejectsWhenNotEveryLoadItemIsInspected() {

        DeliveryLoadItem first = loadItem(300L, 200L, 5);
        DeliveryLoadItem second = loadItem(301L, 201L, 3);

        stubValidAttemptAndAssignment();

        when(orderService.findForUpdateById(100L))
                .thenReturn(Optional.of(
                        sampleOrder(OrderStatus.OUT_FOR_DELIVERY)));

        when(deliveryLoadItemRepository
                .findAllByAssignmentIdOrderByOrderItemIdAscBatchIdAsc(10L))
                .thenReturn(List.of(first, second));

        assertThatThrownBy(() ->
                workflowService.inspectReturn(
                        100L,
                        7L,
                        "DELIVERY_STAFF",
                        request(line(300L, 5, 0))))
                .isInstanceOf(BadRequestException.class)
                .hasMessage(
                        "Every dispatched load item must be inspected exactly once");

        verifyNoInteractions(inventoryReturnPort);

        verify(assignmentAccessPort, never())
                .deactivateAssignment(10L);
    }

    @Test
    void rejectsDuplicateLoadItemInInspectionRequest() {

        DeliveryLoadItem first = loadItem(300L, 200L, 5);
        DeliveryLoadItem second = loadItem(301L, 201L, 3);

        stubValidAttemptAndAssignment();

        when(orderService.findForUpdateById(100L))
                .thenReturn(Optional.of(
                        sampleOrder(OrderStatus.OUT_FOR_DELIVERY)));

        when(deliveryLoadItemRepository
                .findAllByAssignmentIdOrderByOrderItemIdAscBatchIdAsc(10L))
                .thenReturn(List.of(first, second));

        assertThatThrownBy(() ->
                workflowService.inspectReturn(
                        100L,
                        7L,
                        "DELIVERY_STAFF",
                        request(
                                line(300L, 5, 0),
                                line(300L, 3, 0))))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Duplicate load item ID: 300");

        verifyNoInteractions(inventoryReturnPort);

        verify(assignmentAccessPort, never())
                .deactivateAssignment(10L);
    }

    @Test
    void rejectsInspectionQuantityThatDoesNotMatchRemainingQuantity() {

        DeliveryLoadItem item = loadItem(300L, 200L, 5);

        stubValidAttemptAndAssignment();

        when(orderService.findForUpdateById(100L))
                .thenReturn(Optional.of(
                        sampleOrder(OrderStatus.OUT_FOR_DELIVERY)));

        when(deliveryLoadItemRepository
                .findAllByAssignmentIdOrderByOrderItemIdAscBatchIdAsc(10L))
                .thenReturn(List.of(item));

        assertThatThrownBy(() ->
                workflowService.inspectReturn(
                        100L,
                        7L,
                        "DELIVERY_STAFF",
                        request(line(300L, 3, 1))))
                .isInstanceOf(ConflictException.class)
                .hasMessage(
                        "Inspected quantity must equal remaining quantity "
                                + "for load item 300");

        verifyNoInteractions(inventoryReturnPort);

        verify(assignmentAccessPort, never())
                .deactivateAssignment(10L);
    }

    @Test
    void doesNotDeactivateAssignmentWhenBe2ReturnFails() {

        DeliveryLoadItem item = loadItem(300L, 200L, 5);

        stubValidAttemptAndAssignment();

        when(orderService.findForUpdateById(100L))
                .thenReturn(Optional.of(
                        sampleOrder(OrderStatus.OUT_FOR_DELIVERY)));

        when(deliveryLoadItemRepository
                .findAllByAssignmentIdOrderByOrderItemIdAscBatchIdAsc(10L))
                .thenReturn(List.of(item));

        when(returnInspectionRepository.saveAndFlush(
                any(ReturnInspection.class)))
                .thenAnswer(invocation -> {
                    ReturnInspection inspection =
                            invocation.getArgument(0);

                    ReflectionTestUtils.setField(
                            inspection,
                            "id",
                            500L);

                    return inspection;
                });

        doThrow(new RuntimeException("BE2 unavailable"))
                .when(inventoryReturnPort)
                .receiveReturn(
                        100L,
                        List.of(new ReturnStockLine(200L, 300L, 3, 2)),
                        "Return inspection test",
                        7L);

        assertThatThrownBy(() ->
                workflowService.inspectReturn(
                        100L,
                        7L,
                        "DELIVERY_STAFF",
                        request(line(300L, 3, 2))))
                .isInstanceOf(RuntimeException.class)
                .hasMessage("BE2 unavailable");

        verify(returnInspectionRepository)
                .saveAndFlush(any(ReturnInspection.class));

        verifyNoInteractions(returnInspectionLineRepository);

        verify(deliveryLoadItemRepository, never())
                .saveAll(any());

        verify(assignmentAccessPort, never())
                .deactivateAssignment(10L);
    }

    @Test
    void rejectsInvalidAttemptId() {

        assertThatThrownBy(() ->
                workflowService.inspectReturn(
                        0L,
                        7L,
                        "DELIVERY_STAFF",
                        request(line(300L, 3, 2))))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Attempt ID must be positive");

        verifyNoInteractions(
                deliveryAttemptRepository,
                returnInspectionRepository,
                returnInspectionLineRepository,
                deliveryLoadItemRepository,
                assignmentAccessPort,
                inventoryReturnPort,
                orderService);
    }

    private void stubValidAttemptAndAssignment() {

        when(deliveryAttemptRepository.findById(100L))
                .thenReturn(Optional.of(
                        attempt(DeliveryAttemptOutcome.FAILED)));

        when(returnInspectionRepository.existsByAttemptId(100L))
                .thenReturn(false);

        when(assignmentAccessPort.findActiveAssignment(
                10L, 7L, "DELIVERY_STAFF"))
                .thenReturn(assignment(true));
    }

    private DeliveryAttempt attempt(DeliveryAttemptOutcome outcome) {

        return new DeliveryAttempt(
                10L,
                1,
                outcome,
                "Nguyen Van An",
                OffsetDateTime.parse("2026-11-02T10:00:00+07:00"),
                outcome == DeliveryAttemptOutcome.FAILED
                        ? "Recipient could not be contacted"
                        : null,
                "Delivery attempt test");
    }

    private DeliveryAssignmentSnapshot assignment(boolean active) {

        return new DeliveryAssignmentSnapshot(
                10L,
                100L,
                FulfillmentType.DELIVERY,
                OrderStatus.OUT_FOR_DELIVERY,
                active);
    }

    private DeliveryLoadItem loadItem(
            Long loadItemId,
            Long orderItemId,
            int quantityLoaded) {

        DeliveryLoadItem item = new DeliveryLoadItem(
                10L,
                orderItemId,
                300L,
                quantityLoaded);

        ReflectionTestUtils.setField(
                item,
                "id",
                loadItemId);

        return item;
    }

    private ReturnInspectionCreateRequest.Line line(
            Long loadItemId,
            int resellable,
            int damaged) {

        return new ReturnInspectionCreateRequest.Line(
                loadItemId,
                resellable,
                damaged,
                "Inspection line test");
    }

    private ReturnInspectionCreateRequest request(
            ReturnInspectionCreateRequest.Line... lines) {

        return new ReturnInspectionCreateRequest(
                List.of(lines),
                "Return inspection test");
    }

    private OrderResponse sampleOrder(OrderStatus status) {

        return new OrderResponse(
                100L,
                "AF-TEST-100",
                5L,
                7L,
                OrderChannel.WEB,
                FulfillmentType.DELIVERY,
                status,
                PaymentStatus.UNPAID,
                "Nguyen Van An",
                "0901234567",
                "123 Nguyen Trai",
                "Quan 5",
                null,
                new BigDecimal("100.00"),
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                new BigDecimal("100.00"),
                OffsetDateTime.parse("2026-11-02T09:00:00+07:00"),
                null,
                null,
                null,
                List.of());
    }
}
