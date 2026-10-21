package com.aquaflow.customer.order.domain;

import java.util.Map;
import java.util.Set;

public final class OrderStatusPolicy {

    private static final Map<OrderStatus, Set<OrderStatus>> ALLOWED_TRANSITIONS =
            Map.of(
                    OrderStatus.PENDING,
                    Set.of(
                            OrderStatus.CONFIRMED,
                            OrderStatus.PREPARING,
                            OrderStatus.CANCELLED
                    ),

                    OrderStatus.CONFIRMED,
                    Set.of(
                            OrderStatus.PREPARING,
                            OrderStatus.CANCELLED
                    ),

                    OrderStatus.PREPARING,
                    Set.of(
                            OrderStatus.OUT_FOR_DELIVERY,
                            OrderStatus.DELIVERED,
                            OrderStatus.COMPLETED,
                            OrderStatus.CANCELLED
                    ),

                    OrderStatus.OUT_FOR_DELIVERY,
                    Set.of(
                            OrderStatus.DELIVERED,
                            OrderStatus.COMPLETED
                    ),

                    OrderStatus.DELIVERED,
                    Set.of(OrderStatus.COMPLETED),

                    OrderStatus.COMPLETED,
                    Set.of(),

                    OrderStatus.CANCELLED,
                    Set.of()
            );

    private OrderStatusPolicy() {
    }

    public static boolean canTransition(
            OrderStatus currentStatus,
            OrderStatus nextStatus) {

        if (currentStatus == null || nextStatus == null) {
            return false;
        }

        return ALLOWED_TRANSITIONS
                .getOrDefault(currentStatus, Set.of())
                .contains(nextStatus);
    }
}
