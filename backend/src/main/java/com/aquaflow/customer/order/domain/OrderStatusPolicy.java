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
                    Set.of(
                            OrderStatus.OUT_FOR_DELIVERY,
                            OrderStatus.DELIVERED,
                            OrderStatus.CANCELLED
                    ),

                    OrderStatus.OUT_FOR_DELIVERY,
                    Set.of(
                            OrderStatus.DELIVERED,
                            OrderStatus.CANCELLED
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
            OrderStatus nextStatus,
            FulfillmentType fulfillmentType) {

        if (currentStatus == null
                || nextStatus == null
                || fulfillmentType == null) {
            return false;
        }

        if (currentStatus == OrderStatus.PREPARING) {
            if (nextStatus == OrderStatus.OUT_FOR_DELIVERY
                    && fulfillmentType != FulfillmentType.DELIVERY) {
                return false;
            }

            if (nextStatus == OrderStatus.DELIVERED
                    && fulfillmentType != FulfillmentType.COUNTER) {
                return false;
            }
        }

        if (currentStatus == OrderStatus.OUT_FOR_DELIVERY
                && fulfillmentType != FulfillmentType.DELIVERY) {
            return false;
        }

        return ALLOWED_TRANSITIONS
                .getOrDefault(currentStatus, Set.of())
                .contains(nextStatus);
    }
}
