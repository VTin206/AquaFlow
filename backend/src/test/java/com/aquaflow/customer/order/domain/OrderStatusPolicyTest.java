package com.aquaflow.customer.order.domain;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OrderStatusPolicyTest {

    @Test
    void allowsPendingToConfirmedForDelivery() {
        assertTrue(OrderStatusPolicy.canTransition(
                OrderStatus.PENDING,
                OrderStatus.CONFIRMED,
                FulfillmentType.DELIVERY));
    }

    @Test
    void allowsPendingToConfirmedForCounter() {
        assertTrue(OrderStatusPolicy.canTransition(
                OrderStatus.PENDING,
                OrderStatus.CONFIRMED,
                FulfillmentType.COUNTER));
    }

    @Test
    void allowsConfirmedToPreparingForDelivery() {
        assertTrue(OrderStatusPolicy.canTransition(
                OrderStatus.CONFIRMED,
                OrderStatus.PREPARING,
                FulfillmentType.DELIVERY));
    }

    @Test
    void allowsConfirmedToPreparingForCounter() {
        assertTrue(OrderStatusPolicy.canTransition(
                OrderStatus.CONFIRMED,
                OrderStatus.PREPARING,
                FulfillmentType.COUNTER));
    }

    @Test
    void allowsPreparingToCancelledForDelivery() {
        assertTrue(OrderStatusPolicy.canTransition(
                OrderStatus.PREPARING,
                OrderStatus.CANCELLED,
                FulfillmentType.DELIVERY));
    }

    @Test
    void allowsPreparingToCancelledForCounter() {
        assertTrue(OrderStatusPolicy.canTransition(
                OrderStatus.PREPARING,
                OrderStatus.CANCELLED,
                FulfillmentType.COUNTER));
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
    void rejectsPreparingToOutForDeliveryThroughGenericTransitionForDelivery() {
        assertFalse(OrderStatusPolicy.canTransition(
                OrderStatus.PREPARING,
                OrderStatus.OUT_FOR_DELIVERY,
                FulfillmentType.DELIVERY));
    }

    @Test
    void rejectsPreparingToOutForDeliveryThroughGenericTransitionForCounter() {
        assertFalse(OrderStatusPolicy.canTransition(
                OrderStatus.PREPARING,
                OrderStatus.OUT_FOR_DELIVERY,
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
    void rejectsOutForDeliveryToDeliveredThroughGenericTransition() {
        assertFalse(OrderStatusPolicy.canTransition(
                OrderStatus.OUT_FOR_DELIVERY,
                OrderStatus.DELIVERED,
                FulfillmentType.DELIVERY));
    }

    @Test
    void rejectsOutForDeliveryToCancelledToAvoidReleasingDispatchedStock() {
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
    void rejectsDeliveredToCompletedThroughGenericTransitionForDelivery() {
        assertFalse(OrderStatusPolicy.canTransition(
                OrderStatus.DELIVERED,
                OrderStatus.COMPLETED,
                FulfillmentType.DELIVERY));
    }

    @Test
    void rejectsDeliveredToCompletedThroughGenericTransitionForCounter() {
        assertFalse(OrderStatusPolicy.canTransition(
                OrderStatus.DELIVERED,
                OrderStatus.COMPLETED,
                FulfillmentType.COUNTER));
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
    void redeliveryIsAllowedOnlyForCancelledFailedDeliveryThroughDedicatedWorkflow() {
        assertTrue(OrderStatusPolicy.canPrepareForRedelivery(
                OrderStatus.CANCELLED, FulfillmentType.DELIVERY, true));
        assertFalse(OrderStatusPolicy.canPrepareForRedelivery(
                OrderStatus.CANCELLED, FulfillmentType.DELIVERY, false));
        assertFalse(OrderStatusPolicy.canPrepareForRedelivery(
                OrderStatus.CANCELLED, FulfillmentType.COUNTER, true));
        assertFalse(OrderStatusPolicy.canPrepareForRedelivery(
                OrderStatus.OUT_FOR_DELIVERY, FulfillmentType.DELIVERY, true));
        assertFalse(OrderStatusPolicy.canTransition(
                OrderStatus.CANCELLED, OrderStatus.PREPARING, FulfillmentType.DELIVERY));
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
