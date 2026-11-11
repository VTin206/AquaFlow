
package com.aquaflow.customer.order.application;

import com.aquaflow.customer.order.api.dto.OrderCreateRequest;
import com.aquaflow.customer.order.api.dto.GuestOrderCreateRequest;
import com.aquaflow.customer.order.api.dto.OrderItemRequest;
import com.aquaflow.customer.order.api.dto.OrderResponse;
import com.aquaflow.customer.order.domain.OrderStatus;
import com.aquaflow.customer.order.domain.Order;
import com.aquaflow.customer.order.domain.OrderChannel;
import com.aquaflow.customer.order.domain.FulfillmentType;
import com.aquaflow.customer.order.domain.OrderItem;
import com.aquaflow.customer.order.api.dto.OrderListItem;
import com.aquaflow.customer.order.api.dto.OrderPageResponse;
import com.aquaflow.customer.order.repository.OrderItemRepository;
import com.aquaflow.customer.order.repository.OrderQueryRepository;
import com.aquaflow.customer.order.repository.OrderRepository;
import com.aquaflow.shared.api.BadRequestException;
import com.aquaflow.shared.api.PageRequestParams;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.Comparator;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
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

@Service
@Transactional(readOnly = true)
public class OrderService {

    /** Giới hạn cửa sổ "tập đơn đang xử lý" để lượng dữ liệu luôn nhỏ. */
    public static final int MAX_WORKING_SET_DAYS = 90;

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final StockReservationService stockReservationService;
    private final ProductRepository productRepository;
    private final OrderQueryRepository orderQueryRepository;
    private final com.aquaflow.workspace.repository.StoreSettingsRepository storeSettings;
    private final Clock clock;

    public OrderService(
            OrderRepository orderRepository,
            OrderItemRepository orderItemRepository,
            StockReservationService stockReservationService,
            ProductRepository productRepository,
            OrderQueryRepository orderQueryRepository,
            com.aquaflow.workspace.repository.StoreSettingsRepository storeSettings,
            Clock clock) {
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.stockReservationService = stockReservationService;
        this.productRepository = productRepository;
        this.orderQueryRepository = orderQueryRepository;
        this.storeSettings = storeSettings;
        this.clock = clock;
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

    @Transactional
    public OrderResponse createForGuest(GuestOrderCreateRequest request) {
        return createOrder(
                request.recipientName(),
                request.recipientPhone(),
                request.deliveryAddress(),
                request.deliveryArea(),
                request.requestedDeliveryAt(),
                request.items(),
                request.note(),
                null,
                null,
                OrderChannel.WEB,
                FulfillmentType.DELIVERY, request.stairFloor(), request.expectedTotal());
    }

    private OrderResponse createOrder(
            OrderCreateRequest request,
            Long customerId,
            Long createdBy,
            OrderChannel channel) {

        return createOrder(
                request.recipientName(),
                request.recipientPhone(),
                request.deliveryAddress(),
                request.deliveryArea(),
                request.requestedDeliveryAt(),
                request.items(),
                request.note(),
                customerId,
                createdBy,
                channel,
                request.fulfillmentType(), request.stairFloor(), request.expectedTotal());
    }

    private OrderResponse createOrder(
            String recipientName,
            String recipientPhone,
            String deliveryAddress,
            String deliveryArea,
            java.time.OffsetDateTime requestedDeliveryAt,
            List<OrderItemRequest> itemRequests,
            String note,
            Long customerId,
            Long createdBy,
            OrderChannel channel,
            FulfillmentType fulfillmentType, int stairFloor, BigDecimal expectedTotal) {

        Order order = new Order(
                generateOrderCode(),
                customerId,
                createdBy,
                channel,
                fulfillmentType,
                recipientName,
                recipientPhone,
                deliveryAddress,
                deliveryArea,
                requestedDeliveryAt,
                BigDecimal.ZERO,
                channel == OrderChannel.WEB && fulfillmentType == FulfillmentType.DELIVERY
                        ? (note == null ? "" : note + "\n") + "Số tầng đi thang bộ: " + stairFloor : note);

        BigDecimal subtotal = BigDecimal.ZERO;
        long units = 0, jugs = 0;
        List<OrderItem> items = new java.util.ArrayList<>();

        for (OrderItemRequest itemRequest : itemRequests) {
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

            units += itemRequest.quantity();
            if (DeliveryPricing.isJug(product.getUnit())) jugs += itemRequest.quantity();
            items.add(item);
            subtotal = subtotal.add(item.getLineTotal());
        }

        BigDecimal fee = channel == OrderChannel.WEB && fulfillmentType == FulfillmentType.DELIVERY
                ? DeliveryPricing.calculate(subtotal, units, jugs, stairFloor, storeSettings.deliveryFees()).deliveryFee() : BigDecimal.ZERO;
        if (expectedTotal != null && expectedTotal.compareTo(subtotal.add(fee)) != 0)
            throw new ConflictException("Giá hoặc phí giao đã thay đổi. Vui lòng tải lại phí giao và kiểm tra tổng tiền.");
        order.updateAmounts(
                subtotal,
                BigDecimal.ZERO,
                fee);

        order.assignTrackingToken(TrackingTokens.generate());
        Order savedOrder = orderRepository.save(order);
        orderItemRepository.saveAll(items);

        return toResponse(savedOrder);
    }

    private String generateOrderCode() {
        return String.format(Locale.ROOT, "AF-%06d", orderRepository.nextOrderCodeNumber());
    }

    /** Trang Đơn hàng: lọc/tìm/phân trang ở SQL, mới nhất trước. */
    public OrderPageResponse search(OrderSearch search, PageRequestParams page) {
        OrderQueryRepository.IdPage ids = orderQueryRepository.search(search, page);
        return new OrderPageResponse(
                listItems(ids.ids()), page.page(), page.size(), ids.total(), page.totalPages(ids.total()),
                orderQueryRepository.statusCounts());
    }

    /** Đơn còn việc phải làm cộng đơn tạo trong {@code days} ngày gần nhất, cho các màn hình vận hành. */
    public List<OrderListItem> workingSet(int days) {
        if (days < 1 || days > MAX_WORKING_SET_DAYS) {
            throw new BadRequestException("days must be between 1 and " + MAX_WORKING_SET_DAYS);
        }
        OffsetDateTime since = OffsetDateTime.now(clock).minusDays(days);
        return listItems(orderQueryRepository.workingSetIds(since));
    }

    /** Lịch sử đơn của một khách cho nhân viên (hồ sơ khách), mới nhất trước. */
    public List<OrderListItem> customerOrders(long customerId) {
        return listItems(orderQueryRepository.customerOrderIds(customerId));
    }

    /** Nạp đơn, dòng hàng và số dư thanh toán theo lô, giữ đúng thứ tự {@code ids}. */
    private List<OrderListItem> listItems(List<Long> ids) {
        if (ids.isEmpty()) return List.of();
        Map<Long, Order> orders = orderRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(Order::getId, Function.identity()));
        Map<Long, List<OrderItem>> items = itemsByOrder(ids);
        Map<Long, OrderQueryRepository.Balance> balances = orderQueryRepository.balances(ids);
        return ids.stream()
                .filter(orders::containsKey)
                .map(id -> {
                    OrderQueryRepository.Balance balance = balances.getOrDefault(id, OrderQueryRepository.Balance.ZERO);
                    return new OrderListItem(toResponse(orders.get(id), items.getOrDefault(id, List.of())),
                            balance.paid(), balance.due(), balance.refundDue(), balance.returned());
                })
                .toList();
    }

    private Map<Long, List<OrderItem>> itemsByOrder(Collection<Long> orderIds) {
        return orderItemRepository.findAllByOrder_IdIn(orderIds).stream()
                .sorted(Comparator.comparing(OrderItem::getId))
                .collect(Collectors.groupingBy(item -> item.getOrder().getId()));
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
        List<Order> orders = orderRepository.findAllByCustomerId(customerId);
        if (orders.isEmpty()) return List.of();
        Map<Long, List<OrderItem>> items = itemsByOrder(orders.stream().map(Order::getId).toList());
        return orders.stream()
                .map(order -> toResponse(order, items.getOrDefault(order.getId(), List.of())))
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
        return toResponse(order, orderItemRepository.findAllByOrder_Id(order.getId()));
    }

    private OrderResponse toResponse(Order order, List<OrderItem> orderItems) {
        List<OrderResponse.OrderItemResponse> items = orderItems
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
                items,
                order.getTrackingToken()
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
