package com.aquaflow.customer.order.domain;

import java.util.Map;
import java.util.Set;

public final class OrderStatusPolicy {

    private static final Map<OrderStatus, Set<OrderStatus>> ALLOWED_TRANSITIONS =
            Map.of(
                    OrderStatus.PENDING,
                    Set.of(
                            OrderStatus.CONFIRMED,
                            OrderStatus.CANCELLED
                    ),

                    OrderStatus.CONFIRMED,
                    Set.of(
                            OrderStatus.PREPARING,
                            OrderStatus.CANCELLED
                    ),

                    OrderStatus.PREPARING,
                    Set.of(OrderStatus.CANCELLED),

                    OrderStatus.OUT_FOR_DELIVERY,
                    Set.of(),

                    OrderStatus.DELIVERED,
                    Set.of(),

                    OrderStatus.COMPLETED,
                    Set.of(),

                    OrderStatus.CANCELLED,
                    Set.of()
            );

    private OrderStatusPolicy() {
    }

    public static boolean canTransition(
            OrderStatus currentStatus,
            OrderStatus nextStatus,
            FulfillmentType fulfillmentType) {

        if (currentStatus == null
                || nextStatus == null
                || fulfillmentType == null) {
            return false;
        }

        // Dispatch advances through Order.markDispatched() inside its stock transaction.
        // The generic status endpoint must never bypass inventory movement;
        // delivery results and completion still require their own workflows.
        return ALLOWED_TRANSITIONS
                .getOrDefault(currentStatus, Set.of())
                .contains(nextStatus);
    }

    /** Redelivery is a dedicated inventory-backed workflow, never a generic status update. */
    public static boolean canPrepareForRedelivery(
            OrderStatus currentStatus,
            FulfillmentType fulfillmentType,
            boolean deliveryFailed) {
        return currentStatus == OrderStatus.CANCELLED
                && fulfillmentType == FulfillmentType.DELIVERY
                && deliveryFailed;
    }
}
