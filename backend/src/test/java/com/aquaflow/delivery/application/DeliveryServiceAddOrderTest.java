package com.aquaflow.delivery.application;

import com.aquaflow.customer.order.repository.OrderItemRepository;
import com.aquaflow.customer.order.repository.OrderRepository;
import com.aquaflow.delivery.api.DeliveryDtos.AddOrderRequest;
import com.aquaflow.delivery.repository.DeliveryRepository;
import com.aquaflow.delivery.repository.DeliveryRepository.OrderRow;
import com.aquaflow.delivery.repository.DeliveryRepository.TripRow;
import com.aquaflow.inventory.application.RedeliveryReservationService;
import com.aquaflow.shared.api.ConflictException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeliveryServiceAddOrderTest {

    private static final long TRIP = 10L;
    private static final long ORDER = 100L;
    private static final long ACTOR = 9L;

    @Mock private DeliveryRepository repository;
    @Mock private AssignmentDispatchService assignmentDispatch;
    @Mock private RedeliveryReservationService redeliveryReservations;
    @Mock private OrderRepository orderRepository;
    @Mock private OrderItemRepository orderItemRepository;

    private DeliveryService service;

    @BeforeEach
    void setUp() {
        service = new DeliveryService(repository, assignmentDispatch, redeliveryReservations,
                orderRepository, orderItemRepository);
    }

    private void tripAndOrder(String orderStatus, String fulfillment, boolean deliveryFailed) {
        when(repository.lockTrip(TRIP))
                .thenReturn(new TripRow(TRIP, 3L, "Driver", null, "CREATED", 1L, null, null, null));
        when(repository.lockOrder(ORDER)).thenReturn(new OrderRow(ORDER, orderStatus, fulfillment, deliveryFailed));
    }

    @Test
    void addOrderRejectsNonStoreStaff() {
        assertThatThrownBy(() -> service.addOrder(TRIP, new AddOrderRequest(ORDER), ACTOR, false))
                .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(repository);
    }

    @Test
    void addOrderRejectsOrderAlreadyOnAnotherTrip() {
        tripAndOrder("PREPARING", "DELIVERY", false);
        when(repository.isAssigned(ORDER)).thenReturn(true);

        assertThatThrownBy(() -> service.addOrder(TRIP, new AddOrderRequest(ORDER), ACTOR, true))
                .isInstanceOf(ConflictException.class);
        verify(repository, never()).addOrder(anyLong(), anyLong());
    }

    @Test
    void addOrderRejectsCounterOrder() {
        tripAndOrder("PREPARING", "COUNTER", false);
        when(repository.isAssigned(ORDER)).thenReturn(false);

        assertThatThrownBy(() -> service.addOrder(TRIP, new AddOrderRequest(ORDER), ACTOR, true))
                .isInstanceOf(ConflictException.class);
        verify(repository, never()).addOrder(anyLong(), anyLong());
    }

    @Test
    void addOrderRejectsOrderThatAlreadyHasDispatchHistory() {
        tripAndOrder("PREPARING", "DELIVERY", false);
        when(repository.isAssigned(ORDER)).thenReturn(false);
        when(repository.hasDispatch(ORDER)).thenReturn(true);

        assertThatThrownBy(() -> service.addOrder(TRIP, new AddOrderRequest(ORDER), ACTOR, true))
                .isInstanceOf(ConflictException.class);
        verify(repository, never()).addOrder(anyLong(), anyLong());
    }

    @Test
    void redeliveryRejectsOrderThatHasNotBeenInspectedAndCancelled() {
        tripAndOrder("OUT_FOR_DELIVERY", "DELIVERY", true);
        when(repository.isAssigned(ORDER)).thenReturn(false);

        assertThatThrownBy(() -> service.addOrder(TRIP, new AddOrderRequest(ORDER, true), ACTOR, true))
                .isInstanceOf(ConflictException.class);
        verifyNoInteractions(redeliveryReservations);
        verify(repository, never()).addOrder(anyLong(), anyLong());
    }

    @Test
    void redeliveryRejectsCancelledOrderThatNeverFailedDelivery() {
        tripAndOrder("CANCELLED", "DELIVERY", false);
        when(repository.isAssigned(ORDER)).thenReturn(false);

        assertThatThrownBy(() -> service.addOrder(TRIP, new AddOrderRequest(ORDER, true), ACTOR, true))
                .isInstanceOf(ConflictException.class);
        verifyNoInteractions(redeliveryReservations);
    }

    @Test
    void preparingDeliveryOrderIsAssignedToTheTrip() {
        tripAndOrder("PREPARING", "DELIVERY", false);
        when(repository.isAssigned(ORDER)).thenReturn(false);
        when(repository.hasDispatch(ORDER)).thenReturn(false);

        service.addOrder(TRIP, new AddOrderRequest(ORDER), ACTOR, true);

        verify(repository).addOrder(TRIP, ORDER);
    }
}
