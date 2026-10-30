package com.aquaflow.customer.order.domain;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OrderDomainTest {

    @Test
    void calculatesTotalFromSubtotalDiscountAndDeliveryFee() {
        Order order = createOrder();

        order.updateAmounts(
                new BigDecimal("250.00"),
                new BigDecimal("20.00"),
                new BigDecimal("10.00"));

        assertThat(order.getTotal())
                .isEqualByComparingTo("240.00");
    }

    @Test
    void rejectsDiscountGreaterThanSubtotal() {
        Order order = createOrder();

        assertThatThrownBy(() -> order.updateAmounts(
                new BigDecimal("100.00"),
                new BigDecimal("120.00"),
                new BigDecimal("10.00")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Discount amount cannot exceed subtotal");
    }

    @Test
    void rejectsNegativeDeliveryFee() {
        assertThatThrownBy(() -> new Order(
                "AF-1001",
                5L,
                7L,
                OrderChannel.WEB,
                FulfillmentType.DELIVERY,
                "Nguyen Van An",
                "0901234567",
                "123 Nguyen Trai",
                "Quan 5",
                OffsetDateTime.parse("2027-01-15T09:00:00+07:00"),
                new BigDecimal("-1.00"),
                null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Delivery fee cannot be negative");
    }

    @Test
    void calculatesOrderItemLineTotal() {
        OrderItem item = new OrderItem(
                createOrder(),
                101L,
                3,
                new BigDecimal("125.50"));

        assertThat(item.getLineTotal())
                .isEqualByComparingTo("376.50");
    }

    @Test
    void rejectsNonPositiveOrderItemQuantity() {
        assertThatThrownBy(() -> new OrderItem(
                createOrder(),
                101L,
                0,
                new BigDecimal("125.50")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Quantity must be greater than zero");
    }

    @Test
    void transitionToConfirmedUpdatesStatusAndTimestamp() {
        Order order = createOrder();

        order.transitionTo(OrderStatus.CONFIRMED);

        assertThat(order.getStatus()).isEqualTo(OrderStatus.CONFIRMED);
        assertThat(order.getConfirmedAt()).isNotNull();
        assertThat(order.getCancelledAt()).isNull();
    }

    @Test
    void transitionToCancelledUpdatesCancellationTimestamp() {
        Order order = createOrder();

        order.transitionTo(OrderStatus.CANCELLED);

        assertThat(order.getStatus()).isEqualTo(OrderStatus.CANCELLED);
        assertThat(order.getCancelledAt()).isNotNull();
    }

    @Test
    void transitionToRejectsInvalidTransition() {
        Order order = createOrder();

        order.transitionTo(OrderStatus.CONFIRMED);
        order.transitionTo(OrderStatus.PREPARING);

        assertThatThrownBy(() -> order.transitionTo(OrderStatus.PENDING))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage(
                        "Invalid order status transition from PREPARING to PENDING");
    }

    @Test
    void transitionToRejectsDeliveryStatusBeforeInventoryDispatchIsImplemented() {
        Order order = createOrder();
        order.transitionTo(OrderStatus.CONFIRMED);
        order.transitionTo(OrderStatus.PREPARING);

        assertThatThrownBy(() -> order.transitionTo(OrderStatus.OUT_FOR_DELIVERY))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage(
                        "Invalid order status transition from PREPARING to OUT_FOR_DELIVERY");
    }

    private Order createOrder() {
        return new Order(
                "AF-1001",
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
                "Order domain test");
    }
}
