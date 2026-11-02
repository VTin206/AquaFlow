package com.aquaflow.delivery.application;

import java.util.HashMap;
import java.util.Map;
import com.aquaflow.customer.order.api.dto.OrderResponse;
import com.aquaflow.customer.order.application.OrderService;
import com.aquaflow.customer.order.domain.FulfillmentType;
import com.aquaflow.customer.order.domain.OrderStatus;
import com.aquaflow.delivery.api.dto.DeliveryDispatchLineResponse;
import com.aquaflow.delivery.api.dto.DeliveryDispatchResponse;
import com.aquaflow.delivery.application.port.DeliveryAssignmentAccessPort;
import com.aquaflow.delivery.application.port.DeliveryAssignmentSnapshot;
import com.aquaflow.delivery.application.port.DispatchedStockLine;
import com.aquaflow.delivery.application.port.InventoryDispatchPort;
import com.aquaflow.delivery.domain.DeliveryLoadItem;
import com.aquaflow.delivery.repository.DeliveryLoadItemRepository;
import com.aquaflow.shared.api.BadRequestException;
import com.aquaflow.shared.api.ConflictException;
import com.aquaflow.shared.api.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@Transactional(readOnly = true)
public class DeliveryDispatchService {

    private final DeliveryAssignmentAccessPort assignmentAccessPort;
    private final InventoryDispatchPort inventoryDispatchPort;
    private final OrderService orderService;
    private final DeliveryLoadItemRepository deliveryLoadItemRepository;

    public DeliveryDispatchService(
            DeliveryAssignmentAccessPort assignmentAccessPort,
            InventoryDispatchPort inventoryDispatchPort,
            OrderService orderService,
            DeliveryLoadItemRepository deliveryLoadItemRepository) {

        this.assignmentAccessPort = assignmentAccessPort;
        this.inventoryDispatchPort = inventoryDispatchPort;
        this.orderService = orderService;
        this.deliveryLoadItemRepository = deliveryLoadItemRepository;
    }

    @Transactional
    public DeliveryDispatchResponse dispatch(
            Long assignmentId,
            Long viewerId,
            String viewerRole) {

        validatePositive(assignmentId, "Assignment ID");
        validatePositive(viewerId, "Viewer ID");

        DeliveryAssignmentSnapshot assignment =
                assignmentAccessPort.findActiveAssignment(
                        assignmentId,
                        viewerId,
                        viewerRole);

        if (assignment == null) {
            throw new NotFoundException(
                    "Delivery assignment not found");
        }

        if (!assignment.active()) {
            throw new ConflictException(
                    "Delivery assignment is inactive");
        }

        if (assignment.fulfillmentType() != FulfillmentType.DELIVERY) {
            throw new BadRequestException(
                    "Only DELIVERY orders can be dispatched");
        }

        OrderResponse order = orderService.findById(
                        assignment.orderId())
                .orElseThrow(() -> new NotFoundException(
                        "Order not found: " + assignment.orderId()));

        if (order.fulfillmentType() != FulfillmentType.DELIVERY) {
            throw new BadRequestException(
                    "Only DELIVERY orders can be dispatched");
        }

        if (order.status() != OrderStatus.PREPARING
                || assignment.orderStatus() != OrderStatus.PREPARING) {

            throw new ConflictException(
                    "Only PREPARING orders can be dispatched");
        }

        if (deliveryLoadItemRepository
                .existsByAssignmentId(assignmentId)) {

            throw new ConflictException(
                    "Delivery assignment has already been dispatched");
        }

        if (order.items() == null || order.items().isEmpty()) {
            throw new ConflictException(
                    "Order has no items to dispatch");
        }

        List<Long> orderItemIds = order.items()
                .stream()
                .map(OrderResponse.OrderItemResponse::id)
                .toList();

        List<DispatchedStockLine> dispatchedLines =
                inventoryDispatchPort.dispatch(
                        order.id(),
                        orderItemIds,
                        viewerId);

        validateDispatchedLines(
                order.items(),
                dispatchedLines);

        List<DeliveryLoadItem> loadItems = dispatchedLines
                .stream()
                .map(line -> new DeliveryLoadItem(
                        assignmentId,
                        line.orderItemId(),
                        line.batchId(),
                        line.quantityDispatched()))
                .toList();

        deliveryLoadItemRepository.saveAll(loadItems);

        OrderResponse updatedOrder = orderService
                .markOutForDeliveryFromDeliveryWorkflow(order.id())
                .orElseThrow(() -> new NotFoundException(
                        "Order not found: " + order.id()));

        if (updatedOrder.status() != OrderStatus.OUT_FOR_DELIVERY) {
            throw new ConflictException(
                    "Order could not be marked as OUT_FOR_DELIVERY");
        }

        List<DeliveryDispatchLineResponse> responseLines =
                dispatchedLines.stream()
                        .map(line -> new DeliveryDispatchLineResponse(
                                line.orderItemId(),
                                line.batchId(),
                                line.lotCode(),
                                line.expiresOn(),
                                line.quantityDispatched()))
                        .toList();

        return new DeliveryDispatchResponse(
                assignmentId,
                order.id(),
                updatedOrder.status(),
                responseLines);
    }

    
    private void validateDispatchedLines(
            List<OrderResponse.OrderItemResponse> orderItems,
            List<DispatchedStockLine> lines) {

        if (lines == null || lines.isEmpty()) {
            throw new ConflictException(
                    "Inventory dispatch returned no dispatched lines");
        }

        Map<Long, Integer> expectedQuantities = new HashMap<>();

        for (OrderResponse.OrderItemResponse item : orderItems) {

            if (item == null
                    || item.id() == null
                    || item.quantity() == null
                    || item.quantity() <= 0) {

                throw new IllegalStateException(
                        "Order contains invalid item data");
            }

            if (expectedQuantities.putIfAbsent(
                    item.id(),
                    item.quantity()) != null) {

                throw new IllegalStateException(
                        "Order contains duplicate item IDs");
            }
        }

        Set<Long> expectedItemIds = expectedQuantities.keySet();

        Set<Long> dispatchedItemIds = new HashSet<>();

        Set<String> uniqueBatchLines = new HashSet<>();

        Map<Long, Integer> actualQuantities = new HashMap<>();

        for (DispatchedStockLine line : lines) {

            if (line == null
                    || line.reservationId() == null
                    || line.orderItemId() == null
                    || line.batchId() == null
                    || line.quantityDispatched() <= 0) {

                throw new IllegalStateException(
                        "Inventory dispatch returned invalid line data");
            }

            if (!expectedItemIds.contains(line.orderItemId())) {

                throw new IllegalStateException(
                        "Inventory dispatch returned an unrelated order item");
            }

            String key = line.orderItemId()
                    + ":"
                    + line.batchId();

            if (!uniqueBatchLines.add(key)) {

                throw new IllegalStateException(
                        "Inventory dispatch returned a duplicate batch line");
            }

            dispatchedItemIds.add(line.orderItemId());

            actualQuantities.merge(
                    line.orderItemId(),
                    line.quantityDispatched(),
                    Integer::sum);
        }

        if (!dispatchedItemIds.containsAll(expectedItemIds)) {

            throw new ConflictException(
                    "Inventory dispatch did not cover every order item");
        }

        for (Map.Entry<Long, Integer> entry
                : expectedQuantities.entrySet()) {

            Long orderItemId = entry.getKey();

            int expectedQuantity = entry.getValue();

            int actualQuantity = actualQuantities.get(orderItemId);

            if (actualQuantity != expectedQuantity) {

                throw new ConflictException(
                        "Dispatched quantity does not match ordered quantity "
                                + "for order item " + orderItemId);
            }
        }
    }


    private void validatePositive(Long value, String fieldName) {
        if (value == null || value <= 0) {
            throw new BadRequestException(
                    fieldName + " must be positive");
        }
    }
}
