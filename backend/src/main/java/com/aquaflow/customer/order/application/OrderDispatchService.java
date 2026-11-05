package com.aquaflow.customer.order.application;

import com.aquaflow.customer.order.api.dto.DispatchResponse;
import com.aquaflow.customer.order.domain.*;
import com.aquaflow.customer.order.repository.*;
import com.aquaflow.delivery.repository.DeliveryRepository;
import com.aquaflow.inventory.application.*;
import com.aquaflow.shared.api.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class OrderDispatchService {
    private final OrderRepository orders;
    private final OrderItemRepository items;
    private final DispatchRepository dispatches;
    private final StockDispatchService stock;
    private final DeliveryRepository deliveryAssignments;

    public OrderDispatchService(OrderRepository orders, OrderItemRepository items,
                                DispatchRepository dispatches, StockDispatchService stock,
                                DeliveryRepository deliveryAssignments) {
        this.orders = orders;
        this.items = items;
        this.dispatches = dispatches;
        this.stock = stock;
        this.deliveryAssignments = deliveryAssignments;
    }

    @Transactional
    public DispatchResponse create(Long orderId, Long actorId) {
        return createInternal(orderId, actorId, false, null);
    }

    /** Delivery-trip dispatch calls this inside the target assignment transaction. */
    @Transactional
    public DispatchResponse createForTrip(Long orderId, Long actorId, Long tripId) {
        return createInternal(orderId, actorId, false, tripId);
    }

    @Transactional
    public DispatchResponse createRedeliveryForTrip(Long orderId, Long actorId, Long tripId) {
        return createInternal(orderId, actorId, true, tripId);
    }

    private DispatchResponse createInternal(Long orderId, Long actorId, boolean redelivery, Long expectedTripId) {
        var snapshot = orders.findById(orderId).orElseThrow(() -> new NotFoundException("Không tìm thấy đơn hàng"));
        if (snapshot.getFulfillmentType() == FulfillmentType.DELIVERY) {
            if (expectedTripId == null) deliveryAssignments.lockDispatchableTripForOrder(orderId);
            else deliveryAssignments.lockDispatchableAssignment(expectedTripId, orderId);
        } else if (expectedTripId != null) {
            throw new ConflictException("Đơn COUNTER không thể thuộc Delivery Trip");
        }

        var order = orders.findForUpdateById(orderId).orElseThrow(() -> new NotFoundException("Không tìm thấy đơn hàng"));
        if (order.getFulfillmentType() != snapshot.getFulfillmentType()) {
            throw new ConflictException("Loại giao nhận của đơn đã thay đổi; hãy tải lại đơn hàng");
        }
        boolean hasHistory = dispatches.hasDispatch(orderId);
        if (hasHistory != redelivery) {
            throw new ConflictException(redelivery
                    ? "Không có phiếu xuất kho cũ để giao lại"
                    : "Đơn đã xuất kho; giao lại phải qua kiểm nhận và reservation mới");
        }
        if (order.getStatus() != OrderStatus.PREPARING)
            throw new ConflictException("Chỉ Dispatch đơn đang PREPARING");
        var lines = items.findAllByOrder_Id(orderId).stream()
                .map(item -> new ReservationLine(item.getId(), item.getProductId(), item.getQuantity())).toList();
        var exported = stock.dispatch(orderId, lines, actorId, order.getFulfillmentType() == FulfillmentType.COUNTER);
        order.markDispatched();
        orders.flush();
        return dispatches.create(orderId, actorId, order.getStatus(), exported);
    }

    public List<DispatchResponse> list(Long orderId) {
        if (!orders.existsById(orderId)) throw new NotFoundException("Không tìm thấy đơn hàng");
        return dispatches.findAllByOrderId(orderId);
    }

    public DispatchResponse find(Long orderId, Long dispatchId) {
        return dispatches.findById(dispatchId).filter(d -> d.orderId().equals(orderId))
                .orElseThrow(() -> new NotFoundException("Không tìm thấy phiếu xuất kho"));
    }
}
