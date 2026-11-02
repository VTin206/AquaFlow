package com.aquaflow.delivery.api.dto;

import com.aquaflow.customer.order.domain.OrderStatus;

public record DeliveryRedeliveryResponse(
        Long previousAttemptId,
        Long orderId,
        OrderStatus orderStatus,
        Long newTripId,
        Long newAssignmentId
) {
}
