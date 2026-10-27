package com.aquaflow.customer.order.api.dto;

import com.aquaflow.customer.order.domain.OrderStatus;
import jakarta.validation.constraints.NotNull;

public record OrderStatusUpdateRequest(
        @NotNull(message = "Order status is required")
        OrderStatus status
) {
}
