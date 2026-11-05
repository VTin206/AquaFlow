package com.aquaflow.delivery.application;

import com.aquaflow.customer.order.api.dto.DispatchResponse;
import com.aquaflow.customer.order.application.OrderDispatchService;
import com.aquaflow.delivery.repository.DeliveryRepository;
import com.aquaflow.delivery.repository.DeliveryRepository.TripRow;
import com.aquaflow.shared.api.BadRequestException;
import com.aquaflow.shared.api.ConflictException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Dispatches one active delivery assignment in its own transaction. */
@Service
public class AssignmentDispatchService {
    private final DeliveryRepository repository;
    private final OrderDispatchService orderDispatch;

    public AssignmentDispatchService(DeliveryRepository repository, OrderDispatchService orderDispatch) {
        this.repository = repository;
        this.orderDispatch = orderDispatch;
    }

    @Transactional
    public DispatchResponse dispatch(long tripId, long orderId, long actorId, boolean storeStaff) {
        return dispatchInternal(tripId, orderId, actorId, storeStaff, false);
    }

    /** Bulk compatibility endpoint calls this once per assignment. */
    @Transactional
    public DispatchResponse dispatchFromTrip(long tripId, long orderId, long actorId, boolean storeStaff) {
        return dispatchInternal(tripId, orderId, actorId, storeStaff, true);
    }

    private DispatchResponse dispatchInternal(long tripId, long orderId, long actorId,
                                              boolean storeStaff, boolean skipAlreadyDispatched) {
        requireStoreStaff(storeStaff);
        TripRow trip = repository.lockTrip(tripId);
        requireStatus(trip, "CREATED");
        if (trip.driverId() == null) throw new ConflictException("Chưa phân công tài xế cho chuyến");
        requireActiveDriver(trip.driverId());

        repository.lockDispatchableAssignment(tripId, orderId);
        var order = repository.lockOrder(orderId);
        boolean hasHistory = repository.hasDispatch(orderId);
        if (skipAlreadyDispatched && "OUT_FOR_DELIVERY".equals(order.status()) && hasHistory) return null;
        if (!"DELIVERY".equals(order.fulfillmentType()) || !"PREPARING".equals(order.status())) {
            throw new ConflictException("Chỉ được Dispatch đơn DELIVERY đang PREPARING");
        }
        if (hasHistory) return orderDispatch.createRedeliveryForTrip(orderId, actorId, tripId);
        return orderDispatch.createForTrip(orderId, actorId, tripId);
    }

    private String requireActiveDriver(long driverId) {
        return repository.activeDriverName(driverId).orElseThrow(() ->
                new BadRequestException("Tài xế không tồn tại, không hoạt động hoặc không có role DELIVERY_STAFF"));
    }

    private static void requireStatus(TripRow trip, String expected) {
        if (!expected.equals(trip.status())) {
            throw new ConflictException("Chuyến phải ở trạng thái " + expected);
        }
    }

    private static void requireStoreStaff(boolean storeStaff) {
        if (!storeStaff) throw new org.springframework.security.access.AccessDeniedException("Chỉ ADMIN hoặc SALES_STAFF");
    }
}
