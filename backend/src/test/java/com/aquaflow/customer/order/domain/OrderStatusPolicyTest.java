package com.aquaflow.customer.order.domain;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OrderStatusPolicyTest {

    @Test
    void allowsPendingToConfirmed() {
        assertTrue(OrderStatusPolicy.canTransition(
                OrderStatus.PENDING,
                OrderStatus.CONFIRMED,
                FulfillmentType.DELIVERY));
    }

    @Test
    void rejectsPendingToPreparing() {
        assertFalse(OrderStatusPolicy.canTransition(
                OrderStatus.PENDING,
                OrderStatus.PREPARING,
                FulfillmentType.DELIVERY));
    }

    @Test
    void allowsConfirmedToPreparing() {
        assertTrue(OrderStatusPolicy.canTransition(
                OrderStatus.CONFIRMED,
                OrderStatus.PREPARING,
                FulfillmentType.DELIVERY));
    }

    @Test
    void allowsPreparingToOutForDeliveryForDelivery() {
        assertTrue(OrderStatusPolicy.canTransition(
                OrderStatus.PREPARING,
                OrderStatus.OUT_FOR_DELIVERY,
                FulfillmentType.DELIVERY));
    }

    @Test
    void allowsOutForDeliveryToDeliveredForDelivery() {
        assertTrue(OrderStatusPolicy.canTransition(
                OrderStatus.OUT_FOR_DELIVERY,
                OrderStatus.DELIVERED,
                FulfillmentType.DELIVERY));
    }

    @Test
    void allowsPreparingToCancelled() {
        assertTrue(OrderStatusPolicy.canTransition(
                OrderStatus.PREPARING,
                OrderStatus.CANCELLED,
                FulfillmentType.DELIVERY));
    }

    @Test
    void rejectsPreparingToOutForDeliveryForCounter() {
        assertFalse(OrderStatusPolicy.canTransition(
                OrderStatus.PREPARING,
                OrderStatus.OUT_FOR_DELIVERY,
                FulfillmentType.COUNTER));
    }

    @Test
    void rejectsOutForDeliveryToDeliveredForCounter() {
        assertFalse(OrderStatusPolicy.canTransition(
                OrderStatus.OUT_FOR_DELIVERY,
                OrderStatus.DELIVERED,
                FulfillmentType.COUNTER));
    }

    @Test
    void rejectsPreparingToDeliveredForDelivery() {
        assertFalse(OrderStatusPolicy.canTransition(
                OrderStatus.PREPARING,
                OrderStatus.DELIVERED,
                FulfillmentType.DELIVERY));
    }

    @Test
    void rejectsPreparingToDeliveredForCounter() {
        assertFalse(OrderStatusPolicy.canTransition(
                OrderStatus.PREPARING,
                OrderStatus.DELIVERED,
                FulfillmentType.COUNTER));
    }

    @Test
    void rejectsOutForDeliveryToCancelled() {
        assertFalse(OrderStatusPolicy.canTransition(
                OrderStatus.OUT_FOR_DELIVERY,
                OrderStatus.CANCELLED,
                FulfillmentType.DELIVERY));
    }

    @Test
    void rejectsOutForDeliveryToCompleted() {
        assertFalse(OrderStatusPolicy.canTransition(
                OrderStatus.OUT_FOR_DELIVERY,
                OrderStatus.COMPLETED,
                FulfillmentType.DELIVERY));
    }

    @Test
    void rejectsDeliveredToCompleted() {
        assertFalse(OrderStatusPolicy.canTransition(
                OrderStatus.DELIVERED,
                OrderStatus.COMPLETED,
                FulfillmentType.DELIVERY));
    }

    @Test
    void rejectsTransitionFromCompleted() {
        assertFalse(OrderStatusPolicy.canTransition(
                OrderStatus.COMPLETED,
                OrderStatus.CANCELLED,
                FulfillmentType.DELIVERY));
    }

    @Test
    void rejectsTransitionFromCancelled() {
        assertFalse(OrderStatusPolicy.canTransition(
                OrderStatus.CANCELLED,
                OrderStatus.PREPARING,
                FulfillmentType.DELIVERY));
    }

    @Test
    void rejectsPreparingBackToPending() {
        assertFalse(OrderStatusPolicy.canTransition(
                OrderStatus.PREPARING,
                OrderStatus.PENDING,
                FulfillmentType.DELIVERY));
    }

    @Test
    void rejectsNullCurrentStatus() {
        assertFalse(OrderStatusPolicy.canTransition(
                null,
                OrderStatus.CONFIRMED,
                FulfillmentType.DELIVERY));
    }

    @Test
    void rejectsNullNextStatus() {
        assertFalse(OrderStatusPolicy.canTransition(
                OrderStatus.PENDING,
                null,
                FulfillmentType.DELIVERY));
    }

    @Test
    void rejectsNullFulfillmentType() {
        assertFalse(OrderStatusPolicy.canTransition(
                OrderStatus.PENDING,
                OrderStatus.CONFIRMED,
                null));
    }

    @Test
    void allowsRedeliveryOnlyForDeliveryOrder() {
        assertTrue(OrderStatusPolicy.canPrepareForRedelivery(
                OrderStatus.OUT_FOR_DELIVERY,
                FulfillmentType.DELIVERY));
    }

    @Test
    void rejectsRedeliveryForCounterOrder() {
        assertFalse(OrderStatusPolicy.canPrepareForRedelivery(
                OrderStatus.OUT_FOR_DELIVERY,
                FulfillmentType.COUNTER));
    }

    @Test
    void rejectsRedeliveryWhenOrderIsNotOutForDelivery() {
        assertFalse(OrderStatusPolicy.canPrepareForRedelivery(
                OrderStatus.PREPARING,
                FulfillmentType.DELIVERY));
    }
}
