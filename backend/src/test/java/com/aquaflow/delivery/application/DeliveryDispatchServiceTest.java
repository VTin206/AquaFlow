
package com.aquaflow.delivery.application;

import com.aquaflow.customer.order.api.dto.OrderResponse;
import com.aquaflow.customer.order.application.OrderService;
import com.aquaflow.customer.order.domain.FulfillmentType;
import com.aquaflow.customer.order.domain.OrderChannel;
import com.aquaflow.customer.order.domain.OrderStatus;
import com.aquaflow.customer.order.domain.PaymentStatus;
import com.aquaflow.delivery.application.port.DeliveryAssignmentAccessPort;
import com.aquaflow.delivery.application.port.DeliveryAssignmentSnapshot;
import com.aquaflow.delivery.application.port.DispatchedStockLine;
import com.aquaflow.delivery.application.port.InventoryDispatchPort;
import com.aquaflow.delivery.domain.DeliveryLoadItem;
import com.aquaflow.delivery.repository.DeliveryLoadItemRepository;
import com.aquaflow.shared.api.BadRequestException;
import com.aquaflow.shared.api.ConflictException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeliveryDispatchServiceTest {

    private static final Long ASSIGNMENT_ID = 10L;
    private static final Long ORDER_ID = 100L;
    private static final Long VIEWER_ID = 20L;
    private static final String VIEWER_ROLE = "DELIVERY_STAFF";

    @Mock
    private DeliveryAssignmentAccessPort assignmentAccessPort;

    @Mock
    private InventoryDispatchPort inventoryDispatchPort;

    @Mock
    private OrderService orderService;

    @Mock
    private DeliveryLoadItemRepository deliveryLoadItemRepository;

    @InjectMocks
    private DeliveryDispatchService deliveryDispatchService;

    @Test
    void dispatchesSuccessfullyWithOneBatch() {

        stubValidAssignmentAndOrder(
                List.of(orderItem(1001L)));

        List<DispatchedStockLine> dispatchedLines =
                List.of(dispatchedLine(1001L, 5L, 10));

        when(inventoryDispatchPort.dispatch(
                ORDER_ID,
                List.of(1001L),
                VIEWER_ID))
                .thenReturn(dispatchedLines);

        when(orderService.markOutForDeliveryFromDeliveryWorkflow(ORDER_ID))
                .thenReturn(Optional.of(
                        order(
                                OrderStatus.OUT_FOR_DELIVERY,
                                FulfillmentType.DELIVERY,
                                List.of(orderItem(1001L)))));

        List<DeliveryLoadItem> savedItems = new ArrayList<>();

        doAnswer(invocation -> {
            Iterable<DeliveryLoadItem> items =
                    invocation.getArgument(0);

            items.forEach(savedItems::add);

            return savedItems;
        }).when(deliveryLoadItemRepository)
                .saveAll(any());

        var response = deliveryDispatchService.dispatch(
                ASSIGNMENT_ID,
                VIEWER_ID,
                VIEWER_ROLE);

        assertThat(response.assignmentId())
                .isEqualTo(ASSIGNMENT_ID);

        assertThat(response.orderId())
                .isEqualTo(ORDER_ID);

        assertThat(response.orderStatus())
                .isEqualTo(OrderStatus.OUT_FOR_DELIVERY);

        assertThat(response.lines()).hasSize(1);

        assertThat(response.lines().get(0).batchId())
                .isEqualTo(5L);

        assertThat(response.lines().get(0).quantityLoaded())
                .isEqualTo(10);

        assertThat(savedItems).hasSize(1);

        assertThat(savedItems.get(0).getAssignmentId())
                .isEqualTo(ASSIGNMENT_ID);

        assertThat(savedItems.get(0).getOrderItemId())
                .isEqualTo(1001L);

        assertThat(savedItems.get(0).getBatchId())
                .isEqualTo(5L);

        assertThat(savedItems.get(0).getQuantityLoaded())
                .isEqualTo(10);

        verify(orderService)
                .markOutForDeliveryFromDeliveryWorkflow(ORDER_ID);
    }

    @Test
    void preservesSeparateLinesWhenOrderItemUsesMultipleBatches() {

        List<OrderResponse.OrderItemResponse> items = List.of(
                orderItem(1001L, 25),
                orderItem(1002L, 10));

        stubValidAssignmentAndOrder(items);

        List<DispatchedStockLine> dispatchedLines = List.of(
                dispatchedLine(1001L, 5L, 10),
                dispatchedLine(1001L, 6L, 15),
                dispatchedLine(1002L, 8L, 10));

        when(inventoryDispatchPort.dispatch(
                ORDER_ID,
                List.of(1001L, 1002L),
                VIEWER_ID))
                .thenReturn(dispatchedLines);

        when(orderService.markOutForDeliveryFromDeliveryWorkflow(ORDER_ID))
                .thenReturn(Optional.of(
                        order(
                                OrderStatus.OUT_FOR_DELIVERY,
                                FulfillmentType.DELIVERY,
                                items)));

        List<DeliveryLoadItem> savedItems = new ArrayList<>();

        doAnswer(invocation -> {
            Iterable<DeliveryLoadItem> values =
                    invocation.getArgument(0);

            values.forEach(savedItems::add);

            return savedItems;
        }).when(deliveryLoadItemRepository)
                .saveAll(any());

        var response = deliveryDispatchService.dispatch(
                ASSIGNMENT_ID,
                VIEWER_ID,
                VIEWER_ROLE);

        assertThat(response.lines()).hasSize(3);

        assertThat(savedItems).hasSize(3);

        assertThat(savedItems)
                .extracting(DeliveryLoadItem::getBatchId)
                .containsExactly(5L, 6L, 8L);

        assertThat(savedItems)
                .extracting(DeliveryLoadItem::getOrderItemId)
                .containsExactly(1001L, 1001L, 1002L);

        assertThat(savedItems)
                .extracting(DeliveryLoadItem::getQuantityLoaded)
                .containsExactly(10, 15, 10);
    }

    @Test
    void rejectsInactiveAssignment() {

        when(assignmentAccessPort.findActiveAssignment(
                ASSIGNMENT_ID,
                VIEWER_ID,
                VIEWER_ROLE))
                .thenReturn(new DeliveryAssignmentSnapshot(
                        ASSIGNMENT_ID,
                        ORDER_ID,
                        FulfillmentType.DELIVERY,
                        OrderStatus.PREPARING,
                        false));

        assertThatThrownBy(() ->
                deliveryDispatchService.dispatch(
                        ASSIGNMENT_ID,
                        VIEWER_ID,
                        VIEWER_ROLE))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Delivery assignment is inactive");

        verifyNoInteractions(
                inventoryDispatchPort,
                orderService,
                deliveryLoadItemRepository);
    }

    @Test
    void rejectsCounterAssignment() {

        when(assignmentAccessPort.findActiveAssignment(
                ASSIGNMENT_ID,
                VIEWER_ID,
                VIEWER_ROLE))
                .thenReturn(new DeliveryAssignmentSnapshot(
                        ASSIGNMENT_ID,
                        ORDER_ID,
                        FulfillmentType.COUNTER,
                        OrderStatus.PREPARING,
                        true));

        assertThatThrownBy(() ->
                deliveryDispatchService.dispatch(
                        ASSIGNMENT_ID,
                        VIEWER_ID,
                        VIEWER_ROLE))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Only DELIVERY orders can be dispatched");

        verifyNoInteractions(
                inventoryDispatchPort,
                deliveryLoadItemRepository);
    }

    @Test
    void rejectsOrderThatIsNotPreparing() {

        when(assignmentAccessPort.findActiveAssignment(
                ASSIGNMENT_ID,
                VIEWER_ID,
                VIEWER_ROLE))
                .thenReturn(new DeliveryAssignmentSnapshot(
                        ASSIGNMENT_ID,
                        ORDER_ID,
                        FulfillmentType.DELIVERY,
                        OrderStatus.CONFIRMED,
                        true));

        when(orderService.findById(ORDER_ID))
                .thenReturn(Optional.of(
                        order(
                                OrderStatus.CONFIRMED,
                                FulfillmentType.DELIVERY,
                                List.of(orderItem(1001L)))));

        assertThatThrownBy(() ->
                deliveryDispatchService.dispatch(
                        ASSIGNMENT_ID,
                        VIEWER_ID,
                        VIEWER_ROLE))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Only PREPARING orders can be dispatched");

        verifyNoInteractions(inventoryDispatchPort);

        verify(deliveryLoadItemRepository, never())
                .saveAll(any());

        verify(orderService, never())
                .markOutForDeliveryFromDeliveryWorkflow(ORDER_ID);
    }

    @Test
    void rejectsDuplicateDispatchForSameAssignment() {

        stubValidAssignmentAndOrder(
                List.of(orderItem(1001L)));

        when(deliveryLoadItemRepository.existsByAssignmentId(ASSIGNMENT_ID))
                .thenReturn(true);

        assertThatThrownBy(() ->
                deliveryDispatchService.dispatch(
                        ASSIGNMENT_ID,
                        VIEWER_ID,
                        VIEWER_ROLE))
                .isInstanceOf(ConflictException.class)
                .hasMessage(
                        "Delivery assignment has already been dispatched");

        verifyNoInteractions(inventoryDispatchPort);

        verify(deliveryLoadItemRepository, never())
                .saveAll(any());

        verify(orderService, never())
                .markOutForDeliveryFromDeliveryWorkflow(ORDER_ID);
    }

    @Test
    void doesNotSaveLoadItemsWhenInventoryDispatchFails() {

        stubValidAssignmentAndOrder(
                List.of(orderItem(1001L)));

        when(inventoryDispatchPort.dispatch(
                ORDER_ID,
                List.of(1001L),
                VIEWER_ID))
                .thenThrow(new ConflictException(
                        "Reservation has already been dispatched"));

        assertThatThrownBy(() ->
                deliveryDispatchService.dispatch(
                        ASSIGNMENT_ID,
                        VIEWER_ID,
                        VIEWER_ROLE))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Reservation has already been dispatched");

        verify(deliveryLoadItemRepository, never())
                .saveAll(any());

        verify(orderService, never())
                .markOutForDeliveryFromDeliveryWorkflow(ORDER_ID);
    }

    @Test
    void doesNotUpdateOrderWhenSavingLoadItemsFails() {

        stubValidAssignmentAndOrder(
                List.of(orderItem(1001L)));

        when(inventoryDispatchPort.dispatch(
                ORDER_ID,
                List.of(1001L),
                VIEWER_ID))
                .thenReturn(List.of(
                        dispatchedLine(1001L, 5L, 10)));

        doThrow(new IllegalStateException("Database write failed"))
                .when(deliveryLoadItemRepository)
                .saveAll(any());

        assertThatThrownBy(() ->
                deliveryDispatchService.dispatch(
                        ASSIGNMENT_ID,
                        VIEWER_ID,
                        VIEWER_ROLE))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Database write failed");

        verify(orderService, never())
                .markOutForDeliveryFromDeliveryWorkflow(ORDER_ID);
    }

    @Test
    void rejectsDispatchWhenBe2DoesNotReturnEveryOrderItem() {

        List<OrderResponse.OrderItemResponse> items = List.of(
                orderItem(1001L, 25),
                orderItem(1002L, 10));

        stubValidAssignmentAndOrder(items);

        when(inventoryDispatchPort.dispatch(
                ORDER_ID,
                List.of(1001L, 1002L),
                VIEWER_ID))
                .thenReturn(List.of(
                        dispatchedLine(1001L, 5L, 10)));

        assertThatThrownBy(() ->
                deliveryDispatchService.dispatch(
                        ASSIGNMENT_ID,
                        VIEWER_ID,
                        VIEWER_ROLE))
                .isInstanceOf(ConflictException.class)
                .hasMessage(
                        "Inventory dispatch did not cover every order item");

        verify(deliveryLoadItemRepository, never())
                .saveAll(any());

        verify(orderService, never())
                .markOutForDeliveryFromDeliveryWorkflow(ORDER_ID);
    }

    @Test
    void rejectsDispatchedLineForUnrelatedOrderItem() {

        stubValidAssignmentAndOrder(
                List.of(orderItem(1001L)));

        when(inventoryDispatchPort.dispatch(
                ORDER_ID,
                List.of(1001L),
                VIEWER_ID))
                .thenReturn(List.of(
                        dispatchedLine(9999L, 5L, 10)));

        assertThatThrownBy(() ->
                deliveryDispatchService.dispatch(
                        ASSIGNMENT_ID,
                        VIEWER_ID,
                        VIEWER_ROLE))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage(
                        "Inventory dispatch returned an unrelated order item");

        verify(deliveryLoadItemRepository, never())
                .saveAll(any());

        verify(orderService, never())
                .markOutForDeliveryFromDeliveryWorkflow(ORDER_ID);
    }

    @Test
    void rejectsOrderWithoutItemsBeforeCallingInventoryDispatch() {

        stubValidAssignmentAndOrder(List.of());

        assertThatThrownBy(() ->
                deliveryDispatchService.dispatch(
                        ASSIGNMENT_ID,
                        VIEWER_ID,
                        VIEWER_ROLE))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Order has no items to dispatch");

        verifyNoInteractions(inventoryDispatchPort);

        verify(deliveryLoadItemRepository, never())
                .saveAll(any());

        verify(orderService, never())
                .markOutForDeliveryFromDeliveryWorkflow(ORDER_ID);
    }

    @Test
    void rejectsDispatchWhenBatchQuantitiesDoNotMatchOrderQuantity() {

        stubValidAssignmentAndOrder(
                List.of(orderItem(1001L, 20)));

        when(inventoryDispatchPort.dispatch(
                ORDER_ID,
                List.of(1001L),
                VIEWER_ID))
                .thenReturn(List.of(
                        dispatchedLine(1001L, 5L, 10),
                        dispatchedLine(1001L, 6L, 5)));

        assertThatThrownBy(() ->
                deliveryDispatchService.dispatch(
                        ASSIGNMENT_ID,
                        VIEWER_ID,
                        VIEWER_ROLE))
                .isInstanceOf(ConflictException.class)
                .hasMessage(
                        "Dispatched quantity does not match ordered quantity "
                                + "for order item 1001");

        verify(deliveryLoadItemRepository, never())
                .saveAll(any());

        verify(orderService, never())
                .markOutForDeliveryFromDeliveryWorkflow(ORDER_ID);
    }

    private void stubValidAssignmentAndOrder(
            List<OrderResponse.OrderItemResponse> items) {

        when(assignmentAccessPort.findActiveAssignment(
                ASSIGNMENT_ID,
                VIEWER_ID,
                VIEWER_ROLE))
                .thenReturn(new DeliveryAssignmentSnapshot(
                        ASSIGNMENT_ID,
                        ORDER_ID,
                        FulfillmentType.DELIVERY,
                        OrderStatus.PREPARING,
                        true));

        when(orderService.findById(ORDER_ID))
                .thenReturn(Optional.of(
                        order(
                                OrderStatus.PREPARING,
                                FulfillmentType.DELIVERY,
                                items)));

        when(deliveryLoadItemRepository.existsByAssignmentId(ASSIGNMENT_ID))
                .thenReturn(false);
    }

    private OrderResponse order(
            OrderStatus status,
            FulfillmentType fulfillmentType,
            List<OrderResponse.OrderItemResponse> items) {

        return new OrderResponse(
                ORDER_ID,
                "AF-TEST-100",
                5L,
                7L,
                OrderChannel.WEB,
                fulfillmentType,
                status,
                PaymentStatus.UNPAID,
                "Nguyen Van An",
                "0901234567",
                "123 Nguyen Trai",
                "Quan 5",
                null,
                new BigDecimal("250.00"),
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                new BigDecimal("250.00"),
                OffsetDateTime.now(),
                null,
                null,
                null,
                items);
    }

    private OrderResponse.OrderItemResponse orderItem(Long itemId) {
        return orderItem(itemId, 10);
    }

    private OrderResponse.OrderItemResponse orderItem(
            Long itemId,
            int quantity) {

        BigDecimal unitPrice = new BigDecimal("25.00");

        BigDecimal lineTotal = unitPrice.multiply(
                BigDecimal.valueOf(quantity));

        return new OrderResponse.OrderItemResponse(
                itemId,
                501L,
                quantity,
                unitPrice,
                lineTotal);
    }

    private DispatchedStockLine dispatchedLine(
            Long orderItemId,
            Long batchId,
            int quantity) {

        return new DispatchedStockLine(
                batchId + 1000L,
                orderItemId,
                501L,
                batchId,
                "LOT-" + batchId,
                LocalDate.of(2027, 3, 15),
                quantity,
                0,
                0,
                quantity);
    }
}
