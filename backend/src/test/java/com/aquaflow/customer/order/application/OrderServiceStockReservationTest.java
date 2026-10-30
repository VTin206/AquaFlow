package com.aquaflow.customer.order.application;

import com.aquaflow.customer.order.domain.FulfillmentType;
import com.aquaflow.customer.order.domain.Order;
import com.aquaflow.customer.order.domain.OrderChannel;
import com.aquaflow.customer.order.domain.OrderItem;
import com.aquaflow.customer.order.domain.OrderStatus;
import com.aquaflow.customer.order.repository.OrderItemRepository;
import com.aquaflow.customer.order.repository.OrderRepository;
import com.aquaflow.inventory.application.ReservationLine;
import com.aquaflow.inventory.application.StockReservationService;
import com.aquaflow.shared.api.ConflictException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderServiceStockReservationTest {

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private OrderItemRepository orderItemRepository;

    @Mock
    private StockReservationService stockReservationService;

    @InjectMocks
    private OrderService orderService;

    @Test
    void confirmReservesEveryOrderItem() {
        Order order = order(1L);
        OrderItem first = item(order, 11L, 101L, 2);
        OrderItem second = item(order, 12L, 102L, 5);
        stubOrder(order, List.of(first, second));

        orderService.transitionStatus(1L, OrderStatus.CONFIRMED);

        verify(stockReservationService).reserve(List.of(
                new ReservationLine(11L, 101L, 2),
                new ReservationLine(12L, 102L, 5)));
    }

    @Test
    void confirmFailsAndDoesNotSaveWhenStockIsInsufficient() {
        Order order = order(1L);
        stubOrderWithoutSave(order, List.of(item(order, 11L, 101L, 99)));
        when(stockReservationService.reserve(anyCollection()))
                .thenThrow(new ConflictException("không đủ hàng"));

        assertThatThrownBy(() -> orderService.transitionStatus(1L, OrderStatus.CONFIRMED))
                .isInstanceOf(ConflictException.class);
        verify(orderRepository, never()).save(any(Order.class));
    }

    @Test
    void repeatedConfirmationDoesNotReserveAgain() {
        Order order = order(1L);
        order.transitionTo(OrderStatus.CONFIRMED);
        when(orderRepository.findForUpdateById(1L)).thenReturn(Optional.of(order));

        assertThatThrownBy(() -> orderService.transitionStatus(1L, OrderStatus.CONFIRMED))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Invalid order status transition from CONFIRMED to CONFIRMED");

        verify(stockReservationService, never()).reserve(anyCollection());
        verify(stockReservationService, never()).release(anyCollection());
        verify(orderRepository, never()).save(any(Order.class));
    }

    @Test
    void cancelConfirmedOrderReleasesReservedStock() {
        Order order = order(1L);
        order.transitionTo(OrderStatus.CONFIRMED);
        stubOrder(order, List.of(item(order, 11L, 101L, 2), item(order, 12L, 102L, 5)));

        orderService.transitionStatus(1L, OrderStatus.CANCELLED);

        verify(stockReservationService).release(List.of(11L, 12L));
        verify(stockReservationService, never()).reserve(anyCollection());
    }

    @Test
    void cancelPendingOrderDoesNotTouchStock() {
        Order order = order(1L);
        when(orderRepository.findForUpdateById(1L)).thenReturn(Optional.of(order));
        when(orderRepository.save(order)).thenReturn(order);

        orderService.transitionStatus(1L, OrderStatus.CANCELLED);

        verify(stockReservationService, never()).release(anyCollection());
        verify(stockReservationService, never()).reserve(anyCollection());
    }

    private void stubOrder(Order order, List<OrderItem> items) {
        stubOrderWithoutSave(order, items);
        when(orderRepository.save(order)).thenReturn(order);
    }

    private void stubOrderWithoutSave(Order order, List<OrderItem> items) {
        when(orderRepository.findForUpdateById(order.getId())).thenReturn(Optional.of(order));
        when(orderItemRepository.findAllByOrder_Id(order.getId())).thenReturn(items);
    }

    private static Order order(Long id) {
        Order order = new Order("AF-" + id, 5L, 7L, OrderChannel.COUNTER, FulfillmentType.COUNTER,
                null, null, null, null, null, BigDecimal.ZERO, null);
        ReflectionTestUtils.setField(order, "id", id);
        return order;
    }

    private static OrderItem item(Order order, Long id, Long productId, int quantity) {
        OrderItem item = new OrderItem(order, productId, quantity, new BigDecimal("20000"));
        ReflectionTestUtils.setField(item, "id", id);
        return item;
    }
}
