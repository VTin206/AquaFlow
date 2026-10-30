package com.aquaflow.delivery.application;

import com.aquaflow.auth.domain.User;
import com.aquaflow.auth.domain.UserStatus;
import com.aquaflow.auth.repository.UserRepository;
import com.aquaflow.customer.order.domain.FulfillmentType;
import com.aquaflow.customer.order.domain.Order;
import com.aquaflow.customer.order.domain.OrderStatus;
import com.aquaflow.customer.order.repository.OrderRepository;
import com.aquaflow.delivery.api.dto.CreateDeliveryAssignmentRequest;
import com.aquaflow.delivery.api.dto.CreateDeliveryTripRequest;
import com.aquaflow.delivery.api.dto.DeliveryAssignmentResponse;
import com.aquaflow.delivery.api.dto.DeliveryTripResponse;
import com.aquaflow.delivery.api.dto.UpdateDeliveryTripRequest;
import com.aquaflow.delivery.domain.DeliveryAssignment;
import com.aquaflow.delivery.domain.DeliveryTrip;
import com.aquaflow.delivery.domain.DeliveryTripStatus;
import com.aquaflow.delivery.repository.DeliveryAssignmentRepository;
import com.aquaflow.delivery.repository.DeliveryTripRepository;
import com.aquaflow.shared.api.BadRequestException;
import com.aquaflow.shared.api.ConflictException;
import com.aquaflow.shared.api.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class DeliveryTripService {

    private static final String DELIVERY_STAFF = "DELIVERY_STAFF";
    private static final String ADMIN = "ADMIN";
    private static final String SALES_STAFF = "SALES_STAFF";

    private final DeliveryTripRepository tripRepository;
    private final DeliveryAssignmentRepository assignmentRepository;
    private final UserRepository userRepository;
    private final OrderRepository orderRepository;

    public DeliveryTripService(
            DeliveryTripRepository tripRepository,
            DeliveryAssignmentRepository assignmentRepository,
            UserRepository userRepository,
            OrderRepository orderRepository) {
        this.tripRepository = tripRepository;
        this.assignmentRepository = assignmentRepository;
        this.userRepository = userRepository;
        this.orderRepository = orderRepository;
    }

    @Transactional
    public DeliveryTripResponse create(CreateDeliveryTripRequest request, Long actorId) {
        User actor = activeUser(actorId);
        User driver = activeDeliveryStaff(request.driverId());
        return toResponse(tripRepository.saveAndFlush(new DeliveryTrip(driver, actor)), List.of());
    }

    public List<DeliveryTripResponse> findAll() {
        List<DeliveryTrip> trips = tripRepository.findAllByOrderByCreatedAtDescIdDesc();
        return trips.stream()
                .map(trip -> toResponse(trip, assignmentRepository.findAllByTrip_IdOrderById(trip.getId())))
                .toList();
    }

    public DeliveryTripResponse findById(Long tripId, Long viewerId, String viewerRole) {
        DeliveryTrip trip = tripRepository.findWithPeopleById(tripId)
                .orElseThrow(() -> new NotFoundException("Delivery trip not found"));
        if (!isManager(viewerRole) && !(DELIVERY_STAFF.equals(viewerRole)
                && trip.getDriver().getId().equals(viewerId))) {
            // A 404 avoids disclosing that another driver's trip exists.
            throw new NotFoundException("Delivery trip not found");
        }
        return toResponse(trip, assignmentRepository.findAllByTrip_IdOrderById(tripId));
    }

    public List<DeliveryTripResponse> findDriverTrips(Long viewerId, String viewerRole) {
        if (!DELIVERY_STAFF.equals(viewerRole)) {
            throw new NotFoundException("Delivery trip not found");
        }
        return tripRepository.findAllByDriver_IdOrderByCreatedAtDescIdDesc(viewerId).stream()
                .map(trip -> toResponse(trip, assignmentRepository.findAllByTrip_IdOrderById(trip.getId())))
                .toList();
    }

    @Transactional
    public DeliveryTripResponse update(Long tripId, UpdateDeliveryTripRequest request) {
        DeliveryTrip trip = tripRepository.findForUpdateById(tripId)
                .orElseThrow(() -> new NotFoundException("Delivery trip not found"));
        if (trip.getStatus() != DeliveryTripStatus.CREATED
                || assignmentRepository.existsByTrip_IdAndActiveTrue(tripId)) {
            throw new ConflictException("A trip can only be updated before it has active assignments");
        }
        trip.changeDriver(activeDeliveryStaff(request.driverId()));
        return toResponse(trip, List.of());
    }

    @Transactional
    public DeliveryTripResponse addAssignment(
            Long tripId,
            CreateDeliveryAssignmentRequest request) {
        // Lock order first across assignment operations; this serializes attempts
        // to place the same order on different trips. The unique partial index is
        // the database-level race guard.
        Order order = orderRepository.findForUpdateById(request.orderId())
                .orElseThrow(() -> new NotFoundException("Order not found"));
        DeliveryTrip trip = tripRepository.findForUpdateById(tripId)
                .orElseThrow(() -> new NotFoundException("Delivery trip not found"));

        if (trip.getStatus() != DeliveryTripStatus.CREATED) {
            throw new ConflictException("Assignments can only be added to a CREATED trip");
        }
        if (order.getFulfillmentType() != FulfillmentType.DELIVERY) {
            throw new BadRequestException("COUNTER orders cannot be assigned to a delivery trip");
        }
        if (order.getStatus() != OrderStatus.PREPARING) {
            throw new ConflictException("Only PREPARING orders can be assigned to a delivery trip");
        }
        if (assignmentRepository.existsByOrder_IdAndActiveTrue(order.getId())) {
            throw new ConflictException("Order already belongs to an active delivery assignment");
        }

        assignmentRepository.saveAndFlush(new DeliveryAssignment(trip, order));
        DeliveryTrip reloaded = tripRepository.findWithPeopleById(tripId)
                .orElseThrow(() -> new NotFoundException("Delivery trip not found"));
        return toResponse(reloaded, assignmentRepository.findAllByTrip_IdOrderById(tripId));
    }

    private User activeDeliveryStaff(Long userId) {
        User user = userRepository.findByIdAndStatus(userId, UserStatus.ACTIVE)
                .orElseThrow(() -> new NotFoundException("Active delivery staff user not found"));
        if (!DELIVERY_STAFF.equals(user.getRole().getCode())) {
            throw new BadRequestException("The assigned user must have the DELIVERY_STAFF role");
        }
        return user;
    }

    private User activeUser(Long userId) {
        return userRepository.findByIdAndStatus(userId, UserStatus.ACTIVE)
                .orElseThrow(() -> new NotFoundException("Authenticated user not found"));
    }

    private boolean isManager(String role) {
        return ADMIN.equals(role) || SALES_STAFF.equals(role);
    }

    private DeliveryTripResponse toResponse(
            DeliveryTrip trip,
            List<DeliveryAssignment> assignments) {
        return new DeliveryTripResponse(
                trip.getId(),
                trip.getDriver().getId(),
                trip.getDriver().getFullName(),
                trip.getStatus().name(),
                trip.getStartedAt(),
                trip.getEndedAt(),
                trip.getCreatedBy().getId(),
                trip.getCreatedAt(),
                assignments.stream().map(this::toResponse).toList());
    }

    private DeliveryAssignmentResponse toResponse(DeliveryAssignment assignment) {
        Order order = assignment.getOrder();
        return new DeliveryAssignmentResponse(
                assignment.getId(),
                order.getId(),
                order.getOrderCode(),
                order.getStatus().name(),
                order.getFulfillmentType().name(),
                order.getRecipientName(),
                order.getRecipientPhone(),
                order.getDeliveryAddress(),
                order.getDeliveryArea(),
                assignment.isActive(),
                assignment.getAssignedAt());
    }
}
