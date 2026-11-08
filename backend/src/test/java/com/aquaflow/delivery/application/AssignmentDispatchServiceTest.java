package com.aquaflow.delivery.application;

import com.aquaflow.customer.order.api.dto.DispatchResponse;
import com.aquaflow.customer.order.application.OrderDispatchService;
import com.aquaflow.customer.order.domain.OrderStatus;
import com.aquaflow.delivery.repository.DeliveryRepository;
import com.aquaflow.delivery.repository.DeliveryRepository.OrderRow;
import com.aquaflow.delivery.repository.DeliveryRepository.TripRow;
import com.aquaflow.shared.api.BadRequestException;
import com.aquaflow.shared.api.ConflictException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AssignmentDispatchServiceTest {

    private static final long TRIP_ID = 20L;
    private static final long ORDER_ID = 30L;
    private static final long DRIVER_ID = 40L;
    private static final long ACTOR_ID = 50L;

    @Mock private DeliveryRepository repository;
    @Mock private OrderDispatchService orderDispatch;

    private AssignmentDispatchService service;

    @BeforeEach
    void setUp() {
        service = new AssignmentDispatchService(repository, orderDispatch);
    }

    @Test
    void dispatchesValidActiveDeliveryAssignment() {
        stubEligibleDispatch("PREPARING", "DELIVERY");
        DispatchResponse expected = response();
        when(orderDispatch.createForTrip(ORDER_ID, ACTOR_ID, TRIP_ID)).thenReturn(expected);

        DispatchResponse actual = service.dispatch(TRIP_ID, ORDER_ID, ACTOR_ID, true);

        assertThat(actual).isSameAs(expected);
        verify(repository).lockDispatchableAssignment(TRIP_ID, ORDER_ID);
        verify(orderDispatch).createForTrip(ORDER_ID, ACTOR_ID, TRIP_ID);
        verify(orderDispatch, never()).createRedeliveryForTrip(ORDER_ID, ACTOR_ID, TRIP_ID);
    }

    @Test
    void rejectsCallerWithoutStoreStaffPermission() {
        assertThatThrownBy(() -> service.dispatch(TRIP_ID, ORDER_ID, ACTOR_ID, false))
                .isInstanceOf(AccessDeniedException.class);

        verifyNoInteractions(repository, orderDispatch);
    }

    @Test
    void rejectsTripThatIsNotCreated() {
        when(repository.lockTrip(TRIP_ID)).thenReturn(trip("IN_PROGRESS", DRIVER_ID));

        assertThatThrownBy(() -> service.dispatch(TRIP_ID, ORDER_ID, ACTOR_ID, true))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("CREATED");

        verify(repository, never()).activeDriverName(DRIVER_ID);
        verifyNoInteractions(orderDispatch);
    }

    @Test
    void rejectsTripWithoutAssignedDriver() {
        when(repository.lockTrip(TRIP_ID)).thenReturn(trip("CREATED", null));

        assertThatThrownBy(() -> service.dispatch(TRIP_ID, ORDER_ID, ACTOR_ID, true))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("tài xế");

        verifyNoInteractions(orderDispatch);
    }

    @Test
    void rejectsInactiveOrNonDeliveryDriver() {
        when(repository.lockTrip(TRIP_ID)).thenReturn(trip("CREATED", DRIVER_ID));
        when(repository.activeDriverName(DRIVER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.dispatch(TRIP_ID, ORDER_ID, ACTOR_ID, true))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("DELIVERY_STAFF");

        verify(repository, never()).lockDispatchableAssignment(TRIP_ID, ORDER_ID);
        verifyNoInteractions(orderDispatch);
    }

    @Test
    void rejectsInactiveOrInvalidAssignmentBeforeLockingOrder() {
        when(repository.lockTrip(TRIP_ID)).thenReturn(trip("CREATED", DRIVER_ID));
        when(repository.activeDriverName(DRIVER_ID)).thenReturn(Optional.of("Tài xế"));
        org.mockito.Mockito.doThrow(new ConflictException("Assignment không còn hoạt động"))
                .when(repository).lockDispatchableAssignment(TRIP_ID, ORDER_ID);

        assertThatThrownBy(() -> service.dispatch(TRIP_ID, ORDER_ID, ACTOR_ID, true))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("không còn hoạt động");

        verify(repository, never()).lockOrder(ORDER_ID);
        verifyNoInteractions(orderDispatch);
    }

    @Test
    void rejectsCounterOrder() {
        stubEligibleDispatch("PREPARING", "COUNTER");

        assertThatThrownBy(() -> service.dispatch(TRIP_ID, ORDER_ID, ACTOR_ID, true))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("DELIVERY");

        verifyNoInteractions(orderDispatch);
    }

    @Test
    void rejectsOrderThatIsNotPreparing() {
        stubEligibleDispatch("OUT_FOR_DELIVERY", "DELIVERY");

        assertThatThrownBy(() -> service.dispatch(TRIP_ID, ORDER_ID, ACTOR_ID, true))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("PREPARING");

        verifyNoInteractions(orderDispatch);
    }

    @Test
    void usesRedeliveryDispatchForOrderWithHistoricalDispatch() {
        stubEligibleDispatch("PREPARING", "DELIVERY");
        when(repository.hasDispatch(ORDER_ID)).thenReturn(true);
        DispatchResponse expected = response();
        when(orderDispatch.createRedeliveryForTrip(ORDER_ID, ACTOR_ID, TRIP_ID)).thenReturn(expected);

        assertThat(service.dispatch(TRIP_ID, ORDER_ID, ACTOR_ID, true)).isSameAs(expected);

        verify(orderDispatch).createRedeliveryForTrip(ORDER_ID, ACTOR_ID, TRIP_ID);
        verify(orderDispatch, never()).createForTrip(ORDER_ID, ACTOR_ID, TRIP_ID);
    }

    @Test
    void rejectsDirectRedispatchOfOrderAlreadyOutForDelivery() {
        stubEligibleDispatch("OUT_FOR_DELIVERY", "DELIVERY");

        assertThatThrownBy(() -> service.dispatch(TRIP_ID, ORDER_ID, ACTOR_ID, true))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("PREPARING");

        verifyNoInteractions(orderDispatch);
    }

    @Test
    void bulkDispatchSkipsAssignmentAlreadyDispatchedInThisTrip() {
        stubEligibleDispatch("OUT_FOR_DELIVERY", "DELIVERY");
        when(repository.hasDispatch(ORDER_ID)).thenReturn(true);

        assertThat(service.dispatchFromTrip(TRIP_ID, ORDER_ID, ACTOR_ID, true)).isNull();

        verifyNoInteractions(orderDispatch);
    }

    @Test
    void propagatesInventoryDispatchFailure() {
        stubEligibleDispatch("PREPARING", "DELIVERY");
        when(orderDispatch.createForTrip(ORDER_ID, ACTOR_ID, TRIP_ID))
                .thenThrow(new ConflictException("Không đủ hàng để xuất kho"));

        assertThatThrownBy(() -> service.dispatch(TRIP_ID, ORDER_ID, ACTOR_ID, true))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("Không đủ hàng");

        verify(orderDispatch).createForTrip(ORDER_ID, ACTOR_ID, TRIP_ID);
        verify(orderDispatch, never()).createRedeliveryForTrip(ORDER_ID, ACTOR_ID, TRIP_ID);
    }

    private void stubEligibleDispatch(String orderStatus, String fulfillmentType) {
        when(repository.lockTrip(TRIP_ID)).thenReturn(trip("CREATED", DRIVER_ID));
        when(repository.activeDriverName(DRIVER_ID)).thenReturn(Optional.of("Tài xế"));
        when(repository.lockOrder(ORDER_ID)).thenReturn(
                new OrderRow(ORDER_ID, orderStatus, fulfillmentType, false));
    }

    private static TripRow trip(String status, Long driverId) {
        return new TripRow(TRIP_ID, driverId, "Tài xế", "Xe tải", status,
                ACTOR_ID, OffsetDateTime.now(), null, null);
    }

    private static DispatchResponse response() {
        return new DispatchResponse(1L, ORDER_ID, ACTOR_ID, OffsetDateTime.now(),
                OrderStatus.OUT_FOR_DELIVERY, List.of());
    }
}