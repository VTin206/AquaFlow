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

        // Delivery, dispatch and completion are intentionally blocked in Sprint 2.
        // Sprint 3 must introduce the inventory movement and delivery workflow before
        // these states can be enabled again.
        return ALLOWED_TRANSITIONS
                .getOrDefault(currentStatus, Set.of())
                .contains(nextStatus);
    }
}
