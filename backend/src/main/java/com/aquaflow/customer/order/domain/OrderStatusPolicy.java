package com.aquaflow.customer.order.domain;

public final class OrderStatusPolicy {

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

        return switch (currentStatus) {

            case PENDING ->
                    nextStatus == OrderStatus.CONFIRMED
                    || nextStatus == OrderStatus.CANCELLED;

            case CONFIRMED ->
                    nextStatus == OrderStatus.PREPARING
                    || nextStatus == OrderStatus.CANCELLED;

            case PREPARING ->
                    nextStatus == OrderStatus.CANCELLED
                    || (fulfillmentType == FulfillmentType.DELIVERY
                    && nextStatus == OrderStatus.OUT_FOR_DELIVERY);

            case OUT_FOR_DELIVERY ->
                    fulfillmentType == FulfillmentType.DELIVERY
                    && nextStatus == OrderStatus.DELIVERED;

            case DELIVERED, COMPLETED, CANCELLED -> false;
        };
    }

    public static boolean canPrepareForRedelivery(
            OrderStatus currentStatus,
            FulfillmentType fulfillmentType) {

        return currentStatus == OrderStatus.OUT_FOR_DELIVERY
                && fulfillmentType == FulfillmentType.DELIVERY;
    }
}
