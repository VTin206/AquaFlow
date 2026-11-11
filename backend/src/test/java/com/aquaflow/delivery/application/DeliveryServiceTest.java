package com.aquaflow.delivery.application;

import com.aquaflow.customer.order.domain.FulfillmentType;
import com.aquaflow.customer.order.domain.Order;
import com.aquaflow.customer.order.domain.OrderChannel;
import com.aquaflow.customer.order.domain.OrderItem;
import com.aquaflow.customer.order.domain.OrderStatus;
import com.aquaflow.customer.order.repository.OrderItemRepository;
import com.aquaflow.customer.order.repository.OrderRepository;
import com.aquaflow.delivery.api.DeliveryDtos.AddOrderRequest;
import com.aquaflow.delivery.api.DeliveryDtos.AssignmentResponse;
import com.aquaflow.delivery.api.DeliveryDtos.DeliveryResultRequest;
import com.aquaflow.delivery.api.DeliveryDtos.Outcome;
import com.aquaflow.delivery.api.DeliveryDtos.TripResponse;
import com.aquaflow.delivery.repository.DeliveryRepository;
import com.aquaflow.delivery.repository.DeliveryRepository.AssignmentRow;
import com.aquaflow.delivery.repository.DeliveryRepository.OrderRow;
import com.aquaflow.delivery.repository.DeliveryRepository.TripRow;
import com.aquaflow.inventory.application.RedeliveryReservationService;
import com.aquaflow.inventory.application.ReservationLine;
import com.aquaflow.shared.api.BadRequestException;
import com.aquaflow.shared.api.ConflictException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeliveryServiceTest {

    private static final long TRIP_ID = 20L;
    private static final long ORDER_ID = 30L;
    private static final long ACTOR_ID = 40L;
    private static final long ASSIGNMENT_ID = 50L;

    @Mock private DeliveryRepository repository;
    @Mock private AssignmentDispatchService assignmentDispatch;
    @Mock private RedeliveryReservationService redeliveryReservations;
    @Mock private OrderRepository orderRepository;
    @Mock private OrderItemRepository orderItemRepository;
    @Mock private DeliveryBottleService bottleLedger;

    private DeliveryService service;

    @BeforeEach
    void setUp() {
        service = new DeliveryService(repository, assignmentDispatch, redeliveryReservations,
                orderRepository, orderItemRepository, bottleLedger);
    }

    @Test
    void rejectsRedeliveryWhenOrderIsAlreadyAssignedToAnotherTrip() {
        stubCreatedTripAndOrder("CANCELLED", "DELIVERY", true, true);

        assertThatThrownBy(() -> service.addOrder(TRIP_ID, new AddOrderRequest(ORDER_ID, true), ACTOR_ID, true))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("đã thuộc một chuyến khác");

        verifyNoInteractions(redeliveryReservations, orderRepository, orderItemRepository);
        verify(repository, never()).addOrder(TRIP_ID, ORDER_ID);
    }

    @Test
    void doesNotPrepareOrAssignRedeliveryWhenInventoryRejectsUninspectedReturn() {
        Order managedOrder = cancelledFailedOrder();
        OrderItem item = orderItem(managedOrder, 500L, 11L, 2);
        stubCreatedTripAndOrder("CANCELLED", "DELIVERY", true, false);
        when(orderRepository.findForUpdateById(ORDER_ID)).thenReturn(Optional.of(managedOrder));
        when(orderItemRepository.findAllByOrder_Id(ORDER_ID)).thenReturn(List.of(item));
        when(repository.hasDispatch(ORDER_ID)).thenReturn(true);
        when(redeliveryReservations.reserve(anyCollection()))
                .thenThrow(new ConflictException("Hàng hoàn chưa được kiểm nhận đầy đủ"));

        assertThatThrownBy(() -> service.addOrder(TRIP_ID,
                new AddOrderRequest(ORDER_ID, true), ACTOR_ID, true))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("chưa được kiểm nhận đầy đủ");

        assertThat(managedOrder.getStatus()).isEqualTo(OrderStatus.CANCELLED);
        assertThat(managedOrder.getCancelledAt()).isNotNull();
        verify(repository, never()).addOrder(TRIP_ID, ORDER_ID);
        verify(orderRepository, never()).flush();
    }

    @Test
    void createsFreshReservationAndAssignmentBeforeReopeningInspectedRedelivery() {
        Order managedOrder = cancelledFailedOrder();
        OrderItem item = orderItem(managedOrder, 500L, 11L, 2);
        TripRow trip = trip("CREATED", null);
        TripResponse expected = tripResponse("CREATED");
        stubCreatedTripAndOrder("CANCELLED", "DELIVERY", true, false);
        when(orderRepository.findForUpdateById(ORDER_ID)).thenReturn(Optional.of(managedOrder));
        when(orderItemRepository.findAllByOrder_Id(ORDER_ID)).thenReturn(List.of(item));
        when(repository.hasDispatch(ORDER_ID)).thenReturn(true);
        when(repository.findTrip(TRIP_ID)).thenReturn(trip);
        when(repository.viewTrip(trip)).thenReturn(expected);

        TripResponse actual = service.addOrder(TRIP_ID,
                new AddOrderRequest(ORDER_ID, true), ACTOR_ID, true);

        assertThat(actual).isSameAs(expected);
        assertThat(managedOrder.getStatus()).isEqualTo(OrderStatus.PREPARING);
        assertThat(managedOrder.getCancelledAt()).isNull();
        verify(orderRepository).flush();
        InOrder sequence = inOrder(redeliveryReservations, repository);
        sequence.verify(redeliveryReservations).reserve(List.of(new ReservationLine(500L, 11L, 2)));
        sequence.verify(repository).addOrder(TRIP_ID, ORDER_ID);
        verify(repository, never()).removeOrder(TRIP_ID, ORDER_ID);
    }

    @Test
    void rejectsNonDeliveryOrNonCancelledRedeliveryBeforeReservation() {
        stubCreatedTripAndOrder("PREPARING", "DELIVERY", false, false);

        assertThatThrownBy(() -> service.addOrder(TRIP_ID,
                new AddOrderRequest(ORDER_ID, true), ACTOR_ID, true))
                .isInstanceOf(ConflictException.class);

        verifyNoInteractions(redeliveryReservations, orderRepository, orderItemRepository);
        verify(repository, never()).addOrder(TRIP_ID, ORDER_ID);
    }

    @Test
    void rejectsRedeliveryForCounterOrder() {
        stubCreatedTripAndOrder("CANCELLED", "COUNTER", true, false);

        assertThatThrownBy(() -> service.addOrder(TRIP_ID,
                new AddOrderRequest(ORDER_ID, true), ACTOR_ID, true))
                .isInstanceOf(ConflictException.class);

        verifyNoInteractions(redeliveryReservations, orderRepository, orderItemRepository);
    }

    @Test
    void recordsSuccessfulAttemptAndDelegatesDeliveredTransitionToRepository() {
        DeliveryResultRequest request = new DeliveryResultRequest(Outcome.SUCCESS, "Nguyễn An", null, "đã giao");
        TripResponse expected = stubInProgressAttempt();

        TripResponse result = service.recordResult(TRIP_ID, ORDER_ID, request, ACTOR_ID, false);

        assertThat(result).isSameAs(expected);
        verify(repository).recordSuccess(ORDER_ID, ASSIGNMENT_ID);
        verify(bottleLedger).give(ASSIGNMENT_ID, ORDER_ID, ACTOR_ID);
        verify(repository).addAttempt(ASSIGNMENT_ID, 1, request);
        verify(repository, never()).recordFailure(ORDER_ID);
        verifyNoInteractions(redeliveryReservations, orderRepository, orderItemRepository);
    }

    @Test
    void recordsFailedAttemptWithoutRestockingOrReleasingReservation() {
        stubInProgressAttempt();
        DeliveryResultRequest request = new DeliveryResultRequest(Outcome.FAILED, null,
                "khách không có nhà", "đã gọi điện");

        service.recordResult(TRIP_ID, ORDER_ID, request, ACTOR_ID, false);

        verify(repository).recordFailure(ORDER_ID);
        verifyNoInteractions(bottleLedger);
        verify(repository).addAttempt(ASSIGNMENT_ID, 1, request);
        verify(repository, never()).recordSuccess(ORDER_ID, ASSIGNMENT_ID);
        verifyNoInteractions(redeliveryReservations, orderRepository, orderItemRepository);
    }

    @Test
    void rejectsFailedAttemptWithoutFailureReason() {
        stubInProgressAttemptBeforeValidation();
        DeliveryResultRequest request = new DeliveryResultRequest(Outcome.FAILED, null, "  ", null);

        assertThatThrownBy(() -> service.recordResult(TRIP_ID, ORDER_ID, request, ACTOR_ID, false))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("lý do");

        verify(repository, never()).recordFailure(ORDER_ID);
        verify(repository, never()).addAttempt(anyLong(), anyInt(), any());
    }

    @Test
    void rejectsSuccessfulAttemptWithoutRecipientName() {
        stubInProgressAttemptBeforeValidation();

        assertThatThrownBy(() -> service.recordResult(TRIP_ID, ORDER_ID,
                new DeliveryResultRequest(Outcome.SUCCESS, " ", null, null), ACTOR_ID, false))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("tên người nhận");

        verify(repository, never()).recordSuccess(ORDER_ID, ASSIGNMENT_ID);
        verify(repository, never()).addAttempt(anyLong(), anyInt(), any());
    }

    @Test
    void rejectsAttemptWhenTripIsNotInProgress() {
        when(repository.lockTrip(TRIP_ID)).thenReturn(trip("CREATED", ACTOR_ID));

        assertThatThrownBy(() -> service.recordResult(TRIP_ID, ORDER_ID,
                new DeliveryResultRequest(Outcome.FAILED, null, "không nhận", null), ACTOR_ID, false))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("IN_PROGRESS");

        verify(repository, never()).activeAssignment(TRIP_ID, ORDER_ID);
        verify(repository, never()).recordFailure(ORDER_ID);
    }

    @Test
    void rejectsOverwritingExistingAttemptOnSameAssignment() {
        when(repository.lockTrip(TRIP_ID)).thenReturn(trip("IN_PROGRESS", ACTOR_ID));
        when(repository.activeAssignment(TRIP_ID, ORDER_ID)).thenReturn(new AssignmentRow(ASSIGNMENT_ID, ORDER_ID));
        when(repository.latestOutcome(ASSIGNMENT_ID)).thenReturn(Optional.of(Outcome.FAILED));

        assertThatThrownBy(() -> service.recordResult(TRIP_ID, ORDER_ID,
                new DeliveryResultRequest(Outcome.SUCCESS, "Nguyễn An", null, null), ACTOR_ID, false))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("đã có kết quả");

        verify(repository, never()).recordSuccess(ORDER_ID, ASSIGNMENT_ID);
        verify(repository, never()).recordFailure(ORDER_ID);
        verify(repository, never()).addAttempt(anyLong(), anyInt(), any());
    }

    @Test
    void rejectsDriverWhoDoesNotOwnTrip() {
        when(repository.lockTrip(TRIP_ID)).thenReturn(trip("IN_PROGRESS", ACTOR_ID + 1));

        assertThatThrownBy(() -> service.recordResult(TRIP_ID, ORDER_ID,
                new DeliveryResultRequest(Outcome.SUCCESS, "Nguyễn An", null, null), ACTOR_ID, false))
                .isInstanceOf(AccessDeniedException.class);

        verify(repository, never()).activeAssignment(TRIP_ID, ORDER_ID);
    }

    private void stubCreatedTripAndOrder(String status, String fulfillment,
                                         boolean deliveryFailed, boolean assigned) {
        when(repository.lockTrip(TRIP_ID)).thenReturn(trip("CREATED", null));
        when(repository.lockOrder(ORDER_ID)).thenReturn(new OrderRow(ORDER_ID, status, fulfillment, deliveryFailed));
        when(repository.isAssigned(ORDER_ID)).thenReturn(assigned);
    }

    private TripResponse stubInProgressAttempt() {
        TripRow trip = stubInProgressAttemptBeforeValidation();
        TripResponse expected = tripResponse("IN_PROGRESS");
        when(repository.nextAttemptNo(ASSIGNMENT_ID)).thenReturn(1);
        when(repository.findTrip(TRIP_ID)).thenReturn(trip);
        when(repository.viewTrip(trip)).thenReturn(expected);
        return expected;
    }

    private TripRow stubInProgressAttemptBeforeValidation() {
        TripRow trip = trip("IN_PROGRESS", ACTOR_ID);
        when(repository.lockTrip(TRIP_ID)).thenReturn(trip);
        when(repository.activeAssignment(TRIP_ID, ORDER_ID)).thenReturn(new AssignmentRow(ASSIGNMENT_ID, ORDER_ID));
        when(repository.latestOutcome(ASSIGNMENT_ID)).thenReturn(Optional.empty());
        return trip;
    }

    private static Order cancelledFailedOrder() {
        Order order = new Order("AF-" + ORDER_ID, 7L, 8L, OrderChannel.WEB, FulfillmentType.DELIVERY,
                "Nguyễn An", "0900000000", "Địa chỉ giao", "Phường Bến Thành", null,
                BigDecimal.ZERO, null);
        ReflectionTestUtils.setField(order, "id", ORDER_ID);
        order.transitionTo(OrderStatus.CANCELLED);
        ReflectionTestUtils.setField(order, "deliveryFailed", true);
        return order;
    }

    private static OrderItem orderItem(Order order, long itemId, long productId, int quantity) {
        OrderItem item = new OrderItem(order, productId, quantity, new BigDecimal("10000"));
        ReflectionTestUtils.setField(item, "id", itemId);
        return item;
    }

    private static TripRow trip(String status, Long driverId) {
        return new TripRow(TRIP_ID, driverId, "Tài xế", "Xe tải", status,
                ACTOR_ID, OffsetDateTime.now(), null, null);
    }

    private static TripResponse tripResponse(String status) {
        return new TripResponse(TRIP_ID, ACTOR_ID, "Tài xế", "Xe tải", status,
                OffsetDateTime.now(), null, null, ACTOR_ID, List.<AssignmentResponse>of(), null);
    }
}
