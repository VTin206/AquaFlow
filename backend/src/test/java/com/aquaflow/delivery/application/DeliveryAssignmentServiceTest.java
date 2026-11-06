package com.aquaflow.delivery.application;

import com.aquaflow.customer.order.application.OrderDispatchService;
import com.aquaflow.delivery.api.DeliveryDtos.AttemptResponse;
import com.aquaflow.delivery.api.DeliveryDtos.Outcome;
import com.aquaflow.delivery.repository.DeliveryRepository;
import com.aquaflow.delivery.repository.DeliveryRepository.AssignmentContext;
import com.aquaflow.delivery.repository.DeliveryRepository.OrderRow;
import com.aquaflow.delivery.repository.DeliveryRepository.TripRow;
import com.aquaflow.inventory.api.ReturnDtos.AttemptInspection;
import com.aquaflow.inventory.api.ReturnDtos.LineInput;
import com.aquaflow.inventory.application.InventoryReturnService;
import com.aquaflow.shared.api.ConflictException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeliveryAssignmentServiceTest {

    private static final long ASSIGNMENT = 1L;
    private static final long TRIP = 10L;
    private static final long ORDER = 100L;
    private static final long ACTOR = 9L;

    @Mock private DeliveryRepository repository;
    @Mock private DeliveryService delivery;
    @Mock private OrderDispatchService dispatches;
    @Mock private InventoryReturnService returns;

    private DeliveryAssignmentService service;

    @BeforeEach
    void setUp() {
        service = new DeliveryAssignmentService(repository, delivery, dispatches, returns);
    }

    private static TripRow trip(String status) {
        return new TripRow(TRIP, 3L, "Driver", null, status, 1L, null, null, null);
    }

    private void assignment(boolean active, String tripStatus) {
        when(repository.assignment(ASSIGNMENT)).thenReturn(new AssignmentContext(ASSIGNMENT, TRIP, ORDER, active));
        when(repository.lockTrip(TRIP)).thenReturn(trip(tripStatus));
    }

    private static AttemptResponse attempt(long id, Outcome outcome) {
        return new AttemptResponse(id, 1, outcome, null, outcome == Outcome.FAILED ? "Khách vắng nhà" : null,
                null, OffsetDateTime.now());
    }

    @Test
    void dispatchRejectsNonStoreStaff() {
        assertThatThrownBy(() -> service.dispatch(ASSIGNMENT, ACTOR, false))
                .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(dispatches);
    }

    @Test
    void dispatchRejectsInactiveAssignment() {
        assignment(false, "CREATED");
        assertThatThrownBy(() -> service.dispatch(ASSIGNMENT, ACTOR, true))
                .isInstanceOf(ConflictException.class);
        verifyNoInteractions(dispatches);
    }

    @Test
    void dispatchRejectsTripThatAlreadyStarted() {
        assignment(true, "IN_PROGRESS");
        assertThatThrownBy(() -> service.dispatch(ASSIGNMENT, ACTOR, true))
                .isInstanceOf(ConflictException.class);
        verifyNoInteractions(dispatches);
    }

    @Test
    void dispatchRejectsCounterOrder() {
        assignment(true, "CREATED");
        when(repository.lockOrder(ORDER)).thenReturn(new OrderRow(ORDER, "PREPARING", "COUNTER", false));
        assertThatThrownBy(() -> service.dispatch(ASSIGNMENT, ACTOR, true))
                .isInstanceOf(ConflictException.class);
        verifyNoInteractions(dispatches);
    }

    @Test
    void dispatchRejectsOrderThatIsNotPreparing() {
        assignment(true, "CREATED");
        when(repository.lockOrder(ORDER)).thenReturn(new OrderRow(ORDER, "OUT_FOR_DELIVERY", "DELIVERY", false));
        assertThatThrownBy(() -> service.dispatch(ASSIGNMENT, ACTOR, true))
                .isInstanceOf(ConflictException.class);
        verifyNoInteractions(dispatches);
    }

    @Test
    void firstDispatchUsesNormalDispatchOfTheTrip() {
        assignment(true, "CREATED");
        when(repository.lockOrder(ORDER)).thenReturn(new OrderRow(ORDER, "PREPARING", "DELIVERY", false));
        when(repository.hasDispatch(ORDER)).thenReturn(false);

        service.dispatch(ASSIGNMENT, ACTOR, true);

        verify(dispatches).createForTrip(ORDER, ACTOR, TRIP);
        verify(dispatches, never()).createRedeliveryForTrip(anyLong(), anyLong(), anyLong());
    }

    @Test
    void dispatchAfterReturnedDeliveryUsesRedeliveryDispatch() {
        assignment(true, "CREATED");
        when(repository.lockOrder(ORDER)).thenReturn(new OrderRow(ORDER, "PREPARING", "DELIVERY", true));
        when(repository.hasDispatch(ORDER)).thenReturn(true);

        service.dispatch(ASSIGNMENT, ACTOR, true);

        verify(dispatches).createRedeliveryForTrip(ORDER, ACTOR, TRIP);
        verify(dispatches, never()).createForTrip(anyLong(), anyLong(), anyLong());
    }

    private AttemptInspection inspection() {
        return new AttemptInspection(List.of(new LineInput(7L, 2)), "Đã kiểm");
    }

    private void failedAttemptContext(long attemptId, List<AttemptResponse> history) {
        when(repository.assignmentForAttempt(attemptId))
                .thenReturn(new AssignmentContext(ASSIGNMENT, TRIP, ORDER, true));
        when(repository.attemptsForAssignment(ASSIGNMENT)).thenReturn(history);
    }

    @Test
    void inspectRejectsNonStoreStaff() {
        assertThatThrownBy(() -> service.inspect(5L, inspection(), ACTOR, false))
                .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(returns);
    }

    @Test
    void inspectRejectsAnAttemptThatIsNotTheLatest() {
        failedAttemptContext(5L, List.of(attempt(6L, Outcome.FAILED), attempt(5L, Outcome.FAILED)));
        assertThatThrownBy(() -> service.inspect(5L, inspection(), ACTOR, true))
                .isInstanceOf(ConflictException.class);
        verifyNoInteractions(returns);
    }

    @Test
    void inspectRejectsSuccessfulAttempt() {
        failedAttemptContext(5L, List.of(attempt(5L, Outcome.SUCCESS)));
        assertThatThrownBy(() -> service.inspect(5L, inspection(), ACTOR, true))
                .isInstanceOf(ConflictException.class);
        verifyNoInteractions(returns);
    }

    @Test
    void inspectSendsLatestFailedAttemptToInventoryReturn() {
        failedAttemptContext(5L, List.of(attempt(5L, Outcome.FAILED)));

        service.inspect(5L, inspection(), ACTOR, true);

        verify(returns).createForAssignment(
                argThat(create -> create.orderId() == ORDER && create.lines().size() == 1),
                eq(ACTOR), eq(ASSIGNMENT));
    }

    @Test
    void dispatchPropagatesInventoryFailure() {
        assignment(true, "CREATED");
        when(repository.lockOrder(ORDER)).thenReturn(
                new OrderRow(ORDER, "PREPARING", "DELIVERY", false));
        when(repository.hasDispatch(ORDER)).thenReturn(false);
        IllegalStateException inventoryFailure = new IllegalStateException("Inventory dispatch failed");
        when(dispatches.createForTrip(ORDER, ACTOR, TRIP)).thenThrow(inventoryFailure);

        assertThatThrownBy(() -> service.dispatch(ASSIGNMENT, ACTOR, true))
                .isSameAs(inventoryFailure);

        verify(dispatches).createForTrip(ORDER, ACTOR, TRIP);
    }
}
