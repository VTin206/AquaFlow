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
    void rejectsPreparingToCompleted() {
        assertFalse(OrderStatusPolicy.canTransition(
                OrderStatus.PREPARING,
                OrderStatus.COMPLETED,
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
    void allowsPreparingToOutForDelivery() {
        assertTrue(OrderStatusPolicy.canTransition(
                OrderStatus.PREPARING,
                OrderStatus.OUT_FOR_DELIVERY,
                FulfillmentType.DELIVERY));
    }

    @Test
    void allowsOutForDeliveryToDelivered() {
        assertTrue(OrderStatusPolicy.canTransition(
                OrderStatus.OUT_FOR_DELIVERY,
                OrderStatus.DELIVERED,
                FulfillmentType.DELIVERY));
    }

    @Test
    void allowsPreparingToDeliveredForCounterFulfillment() {
        assertTrue(OrderStatusPolicy.canTransition(
                OrderStatus.PREPARING,
                OrderStatus.DELIVERED,
                FulfillmentType.COUNTER));
    }

    @Test
    void rejectsPreparingToDeliveredForDeliveryFulfillment() {
        assertFalse(OrderStatusPolicy.canTransition(
                OrderStatus.PREPARING,
                OrderStatus.DELIVERED,
                FulfillmentType.DELIVERY));
    }

    @Test
    void rejectsPreparingToOutForDeliveryForCounterFulfillment() {
        assertFalse(OrderStatusPolicy.canTransition(
                OrderStatus.PREPARING,
                OrderStatus.OUT_FOR_DELIVERY,
                FulfillmentType.COUNTER));
    }

    @Test
    void allowsDeliveredToCompleted() {
        assertTrue(OrderStatusPolicy.canTransition(
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
    void rejectsTransitionFromPreparingBackToPending() {
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
}
