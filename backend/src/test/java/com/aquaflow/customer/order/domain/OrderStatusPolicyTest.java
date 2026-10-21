package com.aquaflow.customer.order.domain;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OrderStatusPolicyTest {

    @Test
    void allowsPendingToConfirmed() {
        assertTrue(OrderStatusPolicy.canTransition(
                OrderStatus.PENDING,
                OrderStatus.CONFIRMED));
    }

    @Test
    void allowsPendingToPreparing() {
        assertTrue(OrderStatusPolicy.canTransition(
                OrderStatus.PENDING,
                OrderStatus.PREPARING));
    }

    @Test
    void allowsPreparingToOutForDelivery() {
        assertTrue(OrderStatusPolicy.canTransition(
                OrderStatus.PREPARING,
                OrderStatus.OUT_FOR_DELIVERY));
    }

    @Test
    void allowsPreparingToDeliveredForCounterFulfillment() {
        assertTrue(OrderStatusPolicy.canTransition(
                OrderStatus.PREPARING,
                OrderStatus.DELIVERED));
    }

    @Test
    void allowsDeliveredToCompleted() {
        assertTrue(OrderStatusPolicy.canTransition(
                OrderStatus.DELIVERED,
                OrderStatus.COMPLETED));
    }

    @Test
    void rejectsTransitionFromCompleted() {
        assertFalse(OrderStatusPolicy.canTransition(
                OrderStatus.COMPLETED,
                OrderStatus.CANCELLED));
    }

    @Test
    void rejectsTransitionFromCancelled() {
        assertFalse(OrderStatusPolicy.canTransition(
                OrderStatus.CANCELLED,
                OrderStatus.PREPARING));
    }

    @Test
    void rejectsTransitionFromPreparingBackToPending() {
        assertFalse(OrderStatusPolicy.canTransition(
                OrderStatus.PREPARING,
                OrderStatus.PENDING));
    }

    @Test
    void rejectsNullCurrentStatus() {
        assertFalse(OrderStatusPolicy.canTransition(
                null,
                OrderStatus.CONFIRMED));
    }

    @Test
    void rejectsNullNextStatus() {
        assertFalse(OrderStatusPolicy.canTransition(
                OrderStatus.PENDING,
                null));
    }
}
