package com.aquaflow.customer.order.application;

import com.aquaflow.customer.order.api.dto.DispatchResponse;
import com.aquaflow.customer.order.domain.*;
import com.aquaflow.customer.order.repository.*;
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

    public OrderDispatchService(OrderRepository orders, OrderItemRepository items,
                                DispatchRepository dispatches, StockDispatchService stock) {
        this.orders = orders;
        this.items = items;
        this.dispatches = dispatches;
        this.stock = stock;
    }

    @Transactional
    public DispatchResponse create(Long orderId, Long actorId) {
        var order = orders.findForUpdateById(orderId).orElseThrow(() -> new NotFoundException("Không tìm thấy đơn hàng"));
        if (dispatches.findByOrderId(orderId).isPresent()) throw new ConflictException("Đơn đã xuất kho");
        order.markDispatched();
        var lines = items.findAllByOrder_Id(orderId).stream()
                .map(item -> new ReservationLine(item.getId(), item.getProductId(), item.getQuantity())).toList();
        var exported = stock.dispatch(orderId, lines, actorId, order.getFulfillmentType() == FulfillmentType.COUNTER);
        return dispatches.create(orderId, actorId, order.getStatus(), exported);
    }

    public List<DispatchResponse> list(Long orderId) {
        if (!orders.existsById(orderId)) throw new NotFoundException("Không tìm thấy đơn hàng");
        return dispatches.findByOrderId(orderId).stream().toList();
    }

    public DispatchResponse find(Long orderId, Long dispatchId) {
        return dispatches.findByOrderId(orderId).filter(d -> d.id().equals(dispatchId))
                .orElseThrow(() -> new NotFoundException("Không tìm thấy phiếu xuất kho"));
    }
}
