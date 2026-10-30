package com.aquaflow.delivery.application;

import com.aquaflow.auth.domain.Role;
import com.aquaflow.auth.domain.User;
import com.aquaflow.auth.domain.UserStatus;
import com.aquaflow.auth.repository.UserRepository;
import com.aquaflow.customer.order.domain.FulfillmentType;
import com.aquaflow.customer.order.domain.Order;
import com.aquaflow.customer.order.domain.OrderChannel;
import com.aquaflow.customer.order.domain.OrderStatus;
import com.aquaflow.customer.order.repository.OrderRepository;
import com.aquaflow.delivery.api.dto.CreateDeliveryAssignmentRequest;
import com.aquaflow.delivery.api.dto.CreateDeliveryTripRequest;
import com.aquaflow.delivery.domain.DeliveryAssignment;
import com.aquaflow.delivery.domain.DeliveryTrip;
import com.aquaflow.delivery.domain.DeliveryTripStatus;
import com.aquaflow.delivery.repository.DeliveryAssignmentRepository;
import com.aquaflow.delivery.repository.DeliveryTripRepository;
import com.aquaflow.shared.api.BadRequestException;
import com.aquaflow.shared.api.ConflictException;
import com.aquaflow.shared.api.NotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DeliveryTripServiceTest {

    private DeliveryTripRepository trips;
    private DeliveryAssignmentRepository assignments;
    private UserRepository users;
    private OrderRepository orders;
    private DeliveryTripService service;
    private User admin;
    private User driver;
    private DeliveryTrip trip;

    @BeforeEach
    void setUp() {
        trips = mock(DeliveryTripRepository.class);
        assignments = mock(DeliveryAssignmentRepository.class);
        users = mock(UserRepository.class);
        orders = mock(OrderRepository.class);
        service = new DeliveryTripService(trips, assignments, users, orders);

        admin = user(1L, "ADMIN", "Admin");
        driver = user(2L, "DELIVERY_STAFF", "Driver");
        trip = new DeliveryTrip(driver, admin);
        ReflectionTestUtils.setField(trip, "id", 15L);
    }

    @Test
    void createTripRequiresActiveDeliveryStaffAndUsesServerActor() {
        when(users.findByIdAndStatus(2L, UserStatus.ACTIVE)).thenReturn(Optional.of(driver));
        when(users.findByIdAndStatus(1L, UserStatus.ACTIVE)).thenReturn(Optional.of(admin));
        when(trips.saveAndFlush(any(DeliveryTrip.class))).thenAnswer(call -> call.getArgument(0));

        var response = service.create(new CreateDeliveryTripRequest(2L), 1L);

        assertThat(response.status()).isEqualTo("CREATED");
        assertThat(response.driverId()).isEqualTo(2L);
        assertThat(response.createdBy()).isEqualTo(1L);
    }

    @Test
    void rejectsAssigningUserWithoutDeliveryRole() {
        User sales = user(3L, "SALES_STAFF", "Sales");
        when(users.findByIdAndStatus(3L, UserStatus.ACTIVE)).thenReturn(Optional.of(sales));
        when(users.findByIdAndStatus(1L, UserStatus.ACTIVE)).thenReturn(Optional.of(admin));

        assertThatThrownBy(() -> service.create(new CreateDeliveryTripRequest(3L), 1L))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("DELIVERY_STAFF");
        verify(trips, never()).saveAndFlush(any());
    }

    @Test
    void driverCanReadOwnTripButCannotReadAnotherDriversTrip() {
        when(trips.findWithPeopleById(15L)).thenReturn(Optional.of(trip));
        when(assignments.findAllByTrip_IdOrderById(15L)).thenReturn(List.of());

        assertThat(service.findById(15L, 2L, "DELIVERY_STAFF").driverId()).isEqualTo(2L);
        assertThatThrownBy(() -> service.findById(15L, 9L, "DELIVERY_STAFF"))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void driverTripListUsesAuthenticatedDriverId() {
        when(trips.findAllByDriver_IdOrderByCreatedAtDescIdDesc(2L)).thenReturn(List.of(trip));
        when(assignments.findAllByTrip_IdOrderById(15L)).thenReturn(List.of());

        assertThat(service.findDriverTrips(2L, "DELIVERY_STAFF"))
                .extracting(response -> response.driverId())
                .containsExactly(2L);
        assertThatThrownBy(() -> service.findDriverTrips(9L, "SALES_STAFF"))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void rejectsCounterOrderAndDoesNotPersistAssignment() {
        Order order = order(10L, FulfillmentType.COUNTER, OrderStatus.PREPARING);
        when(orders.findForUpdateById(10L)).thenReturn(Optional.of(order));
        when(trips.findForUpdateById(15L)).thenReturn(Optional.of(trip));

        assertThatThrownBy(() -> service.addAssignment(15L, new CreateDeliveryAssignmentRequest(10L)))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("COUNTER");
        verify(assignments, never()).saveAndFlush(any());
    }

    @Test
    void rejectsOrderNotPreparing() {
        Order order = order(10L, FulfillmentType.DELIVERY, OrderStatus.CONFIRMED);
        when(orders.findForUpdateById(10L)).thenReturn(Optional.of(order));
        when(trips.findForUpdateById(15L)).thenReturn(Optional.of(trip));

        assertThatThrownBy(() -> service.addAssignment(15L, new CreateDeliveryAssignmentRequest(10L)))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("PREPARING");
    }

    @Test
    void rejectsOrderAlreadyInAnActiveAssignment() {
        Order order = order(10L, FulfillmentType.DELIVERY, OrderStatus.PREPARING);
        when(orders.findForUpdateById(10L)).thenReturn(Optional.of(order));
        when(trips.findForUpdateById(15L)).thenReturn(Optional.of(trip));
        when(assignments.existsByOrder_IdAndActiveTrue(10L)).thenReturn(true);

        assertThatThrownBy(() -> service.addAssignment(15L, new CreateDeliveryAssignmentRequest(10L)))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("active delivery assignment");
        verify(assignments, never()).saveAndFlush(any());
    }

    @Test
    void assigningValidDeliveryOrderPersistsAssignmentWithoutChangingOrderStatus() {
        Order order = order(10L, FulfillmentType.DELIVERY, OrderStatus.PREPARING);
        when(orders.findForUpdateById(10L)).thenReturn(Optional.of(order));
        when(trips.findForUpdateById(15L)).thenReturn(Optional.of(trip));
        when(assignments.existsByOrder_IdAndActiveTrue(10L)).thenReturn(false);
        when(assignments.saveAndFlush(any(DeliveryAssignment.class)))
                .thenAnswer(call -> call.getArgument(0));
        when(trips.findWithPeopleById(15L)).thenReturn(Optional.of(trip));
        when(assignments.findAllByTrip_IdOrderById(15L)).thenAnswer(call -> {
            DeliveryAssignment assignment = new DeliveryAssignment(trip, order);
            ReflectionTestUtils.setField(assignment, "id", 22L);
            return List.of(assignment);
        });

        var response = service.addAssignment(15L, new CreateDeliveryAssignmentRequest(10L));

        assertThat(order.getStatus()).isEqualTo(OrderStatus.PREPARING);
        assertThat(response.assignments()).hasSize(1);
        assertThat(response.assignments().getFirst().orderId()).isEqualTo(10L);
    }

    @Test
    void rejectsUpdatingTripAfterAssignmentOrLeavingCreatedState() {
        when(trips.findForUpdateById(15L)).thenReturn(Optional.of(trip));
        when(assignments.existsByTrip_IdAndActiveTrue(15L)).thenReturn(true);

        assertThatThrownBy(() -> service.update(15L, new com.aquaflow.delivery.api.dto.UpdateDeliveryTripRequest(2L)))
                .isInstanceOf(ConflictException.class);
        verify(users, never()).findByIdAndStatus(2L, UserStatus.ACTIVE);
    }

    @Test
    void managerCanChangeDriverBeforeAnyActiveAssignment() {
        User replacement = user(9L, "DELIVERY_STAFF", "Replacement");
        when(trips.findForUpdateById(15L)).thenReturn(Optional.of(trip));
        when(assignments.existsByTrip_IdAndActiveTrue(15L)).thenReturn(false);
        when(users.findByIdAndStatus(9L, UserStatus.ACTIVE)).thenReturn(Optional.of(replacement));

        var response = service.update(15L, new com.aquaflow.delivery.api.dto.UpdateDeliveryTripRequest(9L));

        assertThat(response.driverId()).isEqualTo(9L);
        assertThat(response.status()).isEqualTo("CREATED");
    }

    private User user(Long id, String role, String name) {
        User user = new User(new Role(role, role), name, name.toLowerCase() + "@example.test",
                "0900000000", "hash", UserStatus.ACTIVE);
        ReflectionTestUtils.setField(user, "id", id);
        return user;
    }

    private Order order(Long id, FulfillmentType fulfillment, OrderStatus status) {
        Order order = new Order("ORD-" + id, null, 1L, OrderChannel.WEB, fulfillment,
                "Recipient", "0900000000", "Address", "Area", null, BigDecimal.ZERO, null);
        ReflectionTestUtils.setField(order, "id", id);
        ReflectionTestUtils.setField(order, "status", status);
        return order;
    }
}
