package com.aquaflow.customer.order.application;

import com.aquaflow.customer.order.api.dto.OrderCreateRequest;
import com.aquaflow.customer.order.api.dto.OrderItemRequest;
import com.aquaflow.customer.order.api.dto.GuestOrderCreateRequest;
import com.aquaflow.inventory.domain.Product;
import com.aquaflow.inventory.repository.ProductRepository;
import java.util.concurrent.atomic.AtomicReference;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import com.aquaflow.customer.order.api.dto.OrderResponse;
import com.aquaflow.customer.order.domain.FulfillmentType;
import com.aquaflow.customer.order.domain.Order;
import com.aquaflow.customer.order.domain.OrderChannel;
import com.aquaflow.customer.order.domain.OrderItem;
import com.aquaflow.customer.order.domain.OrderStatus;
import com.aquaflow.customer.order.domain.PaymentStatus;
import com.aquaflow.customer.order.repository.OrderItemRepository;
import com.aquaflow.customer.order.repository.OrderRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock
    private ProductRepository productRepository;

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private OrderItemRepository orderItemRepository;

    @Mock
    private com.aquaflow.inventory.application.StockReservationService stockReservationService;

    @InjectMocks
    private OrderService orderService;

    @Test
    void findAllReturnsOrderResponsesWithItems() {
        Order order = createOrder(1L);

        OrderItem item = new OrderItem(
                order,
                101L,
                2,
                new BigDecimal("125.00"));

        ReflectionTestUtils.setField(item, "id", 11L);

        when(orderRepository.findAll())
                .thenReturn(List.of(order));

        when(orderItemRepository.findAllByOrder_Id(1L))
                .thenReturn(List.of(item));

        List<OrderResponse> responses = orderService.findAll();

        assertThat(responses).hasSize(1);

        OrderResponse response = responses.get(0);

        assertThat(response.id()).isEqualTo(1L);
        assertThat(response.orderCode()).isEqualTo("AF-1001");
        assertThat(response.status()).isEqualTo(OrderStatus.PENDING);
        assertThat(response.paymentStatus()).isEqualTo(PaymentStatus.UNPAID);

        assertThat(response.subtotal())
                .isEqualByComparingTo("250.00");

        assertThat(response.discountAmount())
                .isEqualByComparingTo("20.00");

        assertThat(response.deliveryFee())
                .isEqualByComparingTo("10.00");

        assertThat(response.total())
                .isEqualByComparingTo("240.00");

        assertThat(response.items()).hasSize(1);

        OrderResponse.OrderItemResponse itemResponse =
                response.items().get(0);

        assertThat(itemResponse.id()).isEqualTo(11L);
        assertThat(itemResponse.productId()).isEqualTo(101L);
        assertThat(itemResponse.quantity()).isEqualTo(2);

        assertThat(itemResponse.unitPrice())
                .isEqualByComparingTo("125.00");

        assertThat(itemResponse.lineTotal())
                .isEqualByComparingTo("250.00");

        verify(orderItemRepository).findAllByOrder_Id(1L);
    }

    @Test
    void findByIdReturnsOrderWhenFound() {
        Order order = createOrder(2L);

        when(orderRepository.findById(2L))
                .thenReturn(Optional.of(order));

        when(orderItemRepository.findAllByOrder_Id(2L))
                .thenReturn(List.of());

        Optional<OrderResponse> result = orderService.findById(2L);

        assertThat(result).isPresent();
        assertThat(result.orElseThrow().id()).isEqualTo(2L);
        assertThat(result.orElseThrow().orderCode()).isEqualTo("AF-1002");
        assertThat(result.orElseThrow().items()).isEmpty();
    }

    @Test
    void findByIdReturnsEmptyWhenOrderDoesNotExist() {
        when(orderRepository.findById(999L))
                .thenReturn(Optional.empty());

        Optional<OrderResponse> result = orderService.findById(999L);

        assertThat(result).isEmpty();

        verify(orderItemRepository, never())
                .findAllByOrder_Id(999L);
    }

    private Order createOrder(Long id) {
        String orderCode = "AF-100" + id;

        Order order = new Order(
                orderCode,
                5L,
                7L,
                OrderChannel.WEB,
                FulfillmentType.DELIVERY,
                "Nguyen Van An",
                "0901234567",
                "123 Nguyen Trai",
                "Quan 5",
                OffsetDateTime.parse("2027-01-15T09:00:00+07:00"),
                new BigDecimal("10.00"),
                "Order service test");

        order.updateAmounts(
                new BigDecimal("250.00"),
                new BigDecimal("20.00"),
                new BigDecimal("10.00"));

        ReflectionTestUtils.setField(order, "id", id);

        return order;
    }

    @Test
    void transitionStatusUpdatesOrderAndReturnsResponse() {
        Order order = createOrder(3L);

        when(orderRepository.findForUpdateById(3L))
                .thenReturn(Optional.of(order));

        when(orderRepository.save(order))
                .thenReturn(order);

        when(orderItemRepository.findAllByOrder_Id(3L))
                .thenReturn(List.of());

        Optional<OrderResponse> result =
                orderService.transitionStatus(
                        3L,
                        OrderStatus.CONFIRMED);

        assertThat(result).isPresent();
        assertThat(result.orElseThrow().status())
                .isEqualTo(OrderStatus.CONFIRMED);

        assertThat(order.getConfirmedAt()).isNotNull();

        verify(orderRepository).save(order);
    }

    @Test
    void transitionStatusReturnsEmptyWhenOrderDoesNotExist() {
        when(orderRepository.findForUpdateById(999L))
                .thenReturn(Optional.empty());

        Optional<OrderResponse> result =
                orderService.transitionStatus(
                        999L,
                        OrderStatus.CONFIRMED);

        assertThat(result).isEmpty();

        verify(orderRepository, never())
                .save(org.mockito.ArgumentMatchers.any(Order.class));

        verify(orderItemRepository, never())
                .findAllByOrder_Id(999L);
    }

    @Test
    void transitionStatusRejectsInvalidTransitionAndDoesNotSave() {
        Order order = createOrder(4L);

        order.transitionTo(OrderStatus.CONFIRMED);
        order.transitionTo(OrderStatus.PREPARING);

        when(orderRepository.findForUpdateById(4L))
                .thenReturn(Optional.of(order));

        assertThatThrownBy(() ->
                orderService.transitionStatus(
                        4L,
                        OrderStatus.PENDING))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage(
                        "Invalid order status transition from PREPARING to PENDING");

        verify(orderRepository, never())
                .save(org.mockito.ArgumentMatchers.any(Order.class));
    }

    @Test
    void transitionStatusRejectsUnsupportedDeliveryTransitionBeforeSaving() {
        Order order = createOrder(5L);

        order.transitionTo(OrderStatus.CONFIRMED);
        order.transitionTo(OrderStatus.PREPARING);

        when(orderRepository.findForUpdateById(5L))
                .thenReturn(Optional.of(order));

        assertThatThrownBy(() -> orderService.transitionStatus(
                5L,
                OrderStatus.OUT_FOR_DELIVERY))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage(
                        "Invalid order status transition from PREPARING to OUT_FOR_DELIVERY");

        verify(stockReservationService, never()).reserve(anyList());
        verify(stockReservationService, never()).release(anyList());
        verify(orderRepository, never()).save(org.mockito.ArgumentMatchers.any(Order.class));
    }

    @Test
    void createForStaffUsesDatabasePriceAndSavesOrderItems() {
        Product product = new Product(
                "SKU-101",
                "Test Product",
                null,
                "bottle",
                null,
                null,
                new BigDecimal("125.00"));

        ReflectionTestUtils.setField(product, "id", 101L);

        when(productRepository.findById(101L))
                .thenReturn(Optional.of(product));

        AtomicReference<List<OrderItem>> savedItems =
                new AtomicReference<>(List.of());

        when(orderRepository.save(any(Order.class)))
                .thenAnswer(invocation -> {
                    Order order = invocation.getArgument(0);
                    ReflectionTestUtils.setField(order, "id", 25L);
                    return order;
                });

        when(orderItemRepository.saveAll(anyList()))
                .thenAnswer(invocation -> {
                    List<OrderItem> items = invocation.getArgument(0);
                    savedItems.set(items);
                    return items;
                });

        when(orderItemRepository.findAllByOrder_Id(25L))
                .thenAnswer(invocation -> savedItems.get());

        OrderCreateRequest request = new OrderCreateRequest(
                5L,
                OrderChannel.COUNTER,
                FulfillmentType.COUNTER,
                "Nguyen Van An",
                "0901234567",
                null,
                null,
                null,
                List.of(new OrderItemRequest(101L, 2)),
                "Test create order");

        OrderResponse response =
                orderService.createForStaff(request, 7L);

        assertThat(response.id()).isEqualTo(25L);
        assertThat(response.customerId()).isEqualTo(5L);
        assertThat(response.createdBy()).isEqualTo(7L);
        assertThat(response.channel()).isEqualTo(OrderChannel.COUNTER);

        assertThat(response.subtotal())
                .isEqualByComparingTo("250.00");

        assertThat(response.total())
                .isEqualByComparingTo("250.00");

        assertThat(savedItems.get()).hasSize(1);

        assertThat(savedItems.get().get(0).getUnitPrice())
                .isEqualByComparingTo("125.00");

        assertThat(savedItems.get().get(0).getLineTotal())
                .isEqualByComparingTo("250.00");

        verify(orderRepository).save(any(Order.class));
        verify(orderItemRepository).saveAll(anyList());
    }

    @Test
    void createForGuestUsesDatabasePriceStartsPendingAndDoesNotReserveStock() {
        Product product = new Product(
                "SKU-GUEST-101",
                "Guest Product",
                null,
                "bottle",
                null,
                null,
                new BigDecimal("125.00"));

        ReflectionTestUtils.setField(product, "id", 101L);
        when(productRepository.findById(101L)).thenReturn(Optional.of(product));

        AtomicReference<List<OrderItem>> savedItems =
                new AtomicReference<>(List.of());

        when(orderRepository.save(any(Order.class)))
                .thenAnswer(invocation -> {
                    Order order = invocation.getArgument(0);
                    ReflectionTestUtils.setField(order, "id", 26L);
                    return order;
                });
        when(orderItemRepository.saveAll(anyList()))
                .thenAnswer(invocation -> {
                    List<OrderItem> items = invocation.getArgument(0);
                    savedItems.set(items);
                    return items;
                });
        when(orderItemRepository.findAllByOrder_Id(26L))
                .thenAnswer(invocation -> savedItems.get());

        GuestOrderCreateRequest request = new GuestOrderCreateRequest(
                "Nguyen Van An",
                "0901234567",
                "123 Nguyen Trai",
                "Quan 5",
                null,
                List.of(new OrderItemRequest(101L, 2)),
                "Guest order test");

        OrderResponse response = orderService.createForGuest(request);

        assertThat(response.customerId()).isNull();
        assertThat(response.createdBy()).isNull();
        assertThat(response.channel()).isEqualTo(OrderChannel.WEB);
        assertThat(response.fulfillmentType()).isEqualTo(FulfillmentType.DELIVERY);
        assertThat(response.status()).isEqualTo(OrderStatus.PENDING);
        assertThat(response.subtotal()).isEqualByComparingTo("250.00");
        assertThat(savedItems.get()).singleElement()
                .satisfies(item -> {
                    assertThat(item.getUnitPrice()).isEqualByComparingTo("125.00");
                    assertThat(item.getLineTotal()).isEqualByComparingTo("250.00");
                });

        verify(stockReservationService, never()).reserve(anyList());
    }

    @Test
    void createForGuestRejectsInactiveProduct() {
        Product product = new Product(
                "SKU-GUEST-102",
                "Inactive Product",
                null,
                "bottle",
                null,
                null,
                new BigDecimal("125.00"));
        product.deactivate();
        ReflectionTestUtils.setField(product, "id", 102L);
        when(productRepository.findById(102L)).thenReturn(Optional.of(product));

        GuestOrderCreateRequest request = new GuestOrderCreateRequest(
                "Nguyen Van An",
                "0901234567",
                "123 Nguyen Trai",
                "Quan 5",
                null,
                List.of(new OrderItemRequest(102L, 1)),
                null);

        assertThatThrownBy(() -> orderService.createForGuest(request))
                .isInstanceOf(com.aquaflow.shared.api.NotFoundException.class)
                .hasMessage("Active product not found: 102");

        verify(orderRepository, never()).save(any(Order.class));
        verify(stockReservationService, never()).reserve(anyList());
    }
}
