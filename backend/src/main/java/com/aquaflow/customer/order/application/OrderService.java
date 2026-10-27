
package com.aquaflow.customer.order.application;

import com.aquaflow.customer.order.api.dto.OrderCreateRequest;
import com.aquaflow.customer.order.api.dto.OrderItemRequest;
import com.aquaflow.customer.order.api.dto.OrderResponse;
import com.aquaflow.customer.order.domain.OrderStatus;
import com.aquaflow.customer.order.domain.Order;
import com.aquaflow.customer.order.domain.OrderChannel;
import com.aquaflow.customer.order.domain.OrderItem;
import com.aquaflow.customer.order.repository.OrderItemRepository;
import com.aquaflow.customer.order.repository.OrderRepository;
import com.aquaflow.inventory.application.ReservationLine;
import com.aquaflow.inventory.application.StockReservationService;
import com.aquaflow.inventory.domain.Product;
import com.aquaflow.inventory.repository.ProductRepository;
import com.aquaflow.shared.api.ConflictException;
import com.aquaflow.shared.api.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class OrderService {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final StockReservationService stockReservationService;
    private final ProductRepository productRepository;

    public OrderService(
            OrderRepository orderRepository,
            OrderItemRepository orderItemRepository,
            StockReservationService stockReservationService,
            ProductRepository productRepository) {
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.stockReservationService = stockReservationService;
        this.productRepository = productRepository;
    }

    @Transactional
    public OrderResponse createForStaff(
            OrderCreateRequest request,
            Long createdBy) {

        if (request.channel() == OrderChannel.WEB) {
            throw new ConflictException(
                    "WEB orders must use the customer order flow");
        }

        return createOrder(
                request,
                request.customerId(),
                createdBy,
                request.channel());
    }

    @Transactional
    public OrderResponse createForCustomer(
            OrderCreateRequest request,
            Long customerId,
            Long userId) {

        if (customerId == null) {
            throw new NotFoundException(
                    "Customer profile not found for current account");
        }

        return createOrder(
                request,
                customerId,
                userId,
                OrderChannel.WEB);
    }

    private OrderResponse createOrder(
            OrderCreateRequest request,
            Long customerId,
            Long createdBy,
            OrderChannel channel) {

        Order order = new Order(
                generateOrderCode(),
                customerId,
                createdBy,
                channel,
                request.fulfillmentType(),
                request.recipientName(),
                request.recipientPhone(),
                request.deliveryAddress(),
                request.deliveryArea(),
                request.requestedDeliveryAt(),
                BigDecimal.ZERO,
                request.note());

        BigDecimal subtotal = BigDecimal.ZERO;
        List<OrderItem> items = new java.util.ArrayList<>();

        for (OrderItemRequest itemRequest : request.items()) {
            Product product = productRepository
                    .findById(itemRequest.productId())
                    .filter(Product::isActive)
                    .orElseThrow(() -> new NotFoundException(
                            "Active product not found: "
                                    + itemRequest.productId()));

            OrderItem item = new OrderItem(
                    order,
                    product.getId(),
                    itemRequest.quantity(),
                    product.getSalePrice());

            items.add(item);
            subtotal = subtotal.add(item.getLineTotal());
        }

        order.updateAmounts(
                subtotal,
                BigDecimal.ZERO,
                BigDecimal.ZERO);

        Order savedOrder = orderRepository.save(order);
        orderItemRepository.saveAll(items);

        return toResponse(savedOrder);
    }

    private String generateOrderCode() {
        return "AF-" + UUID.randomUUID()
                .toString()
                .replace("-", "")
                .substring(0, 20)
                .toUpperCase(Locale.ROOT);
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

        return orderRepository.findForUpdateById(id)
                .map(order -> {
                    OrderStatus previousStatus = order.getStatus();
                    order.transitionTo(nextStatus);

                    if (nextStatus == OrderStatus.CONFIRMED) {
                        stockReservationService.reserve(
                                orderItemRepository.findAllByOrder_Id(id)
                                        .stream()
                                        .map(item -> new ReservationLine(
                                                item.getId(),
                                                item.getProductId(),
                                                item.getQuantity()))
                                        .toList());
                    }

                    if (nextStatus == OrderStatus.CANCELLED
                            && previousStatus != OrderStatus.PENDING) {
                        stockReservationService.release(
                                orderItemRepository.findAllByOrder_Id(id)
                                        .stream()
                                        .map(OrderItem::getId)
                                        .toList());
                    }

                    Order savedOrder = orderRepository.save(order);
                    return toResponse(savedOrder);
                });
    }

    public List<OrderResponse> findAllByCustomerId(Long customerId) {
        return orderRepository.findAllByCustomerId(customerId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public Optional<OrderResponse> findByIdAndCustomerId(
            Long id,
            Long customerId) {

        return orderRepository.findByIdAndCustomerId(id, customerId)
                .map(this::toResponse);
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
