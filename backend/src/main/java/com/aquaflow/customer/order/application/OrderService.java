package com.aquaflow.customer.order.application;

import com.aquaflow.customer.order.domain.OrderStatus;
import com.aquaflow.customer.order.api.dto.OrderResponse;
import com.aquaflow.customer.order.domain.Order;
import com.aquaflow.customer.order.domain.OrderItem;
import com.aquaflow.customer.order.repository.OrderItemRepository;
import com.aquaflow.customer.order.repository.OrderRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@Transactional(readOnly = true)
public class OrderService {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;

    public OrderService(
            OrderRepository orderRepository,
            OrderItemRepository orderItemRepository) {
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
    }

    public List<OrderResponse> findAll() {
        return orderRepository.findAll()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public Optional<OrderResponse> transitionStatus(
            Long id,
            OrderStatus nextStatus) {

        return orderRepository.findById(id)
                .map(order -> {
                    order.transitionTo(nextStatus);

                    Order savedOrder = orderRepository.save(order);

                    return toResponse(savedOrder);
                });
    }

    public Optional<OrderResponse> findById(Long id) {
        return orderRepository.findById(id)
                .map(this::toResponse);
    }

    private OrderResponse toResponse(Order order) {
        List<OrderResponse.OrderItemResponse> items =
                orderItemRepository.findAllByOrder_Id(order.getId())
                        .stream()
                        .map(this::toItemResponse)
                        .toList();

        return new OrderResponse(
                order.getId(),
                order.getOrderCode(),
                order.getCustomerId(),
                order.getCreatedBy(),
                order.getChannel(),
                order.getFulfillmentType(),
                order.getStatus(),
                order.getPaymentStatus(),
                order.getRecipientName(),
                order.getRecipientPhone(),
                order.getDeliveryAddress(),
                order.getDeliveryArea(),
                order.getRequestedDeliveryAt(),
                order.getSubtotal(),
                order.getDiscountAmount(),
                order.getDeliveryFee(),
                order.getTotal(),
                order.getCreatedAt(),
                order.getConfirmedAt(),
                order.getCancelledAt(),
                order.getNote(),
                items
        );
    }

    private OrderResponse.OrderItemResponse toItemResponse(OrderItem item) {
        return new OrderResponse.OrderItemResponse(
                item.getId(),
                item.getProductId(),
                item.getQuantity(),
                item.getUnitPrice(),
                item.getLineTotal()
        );
    }
}
