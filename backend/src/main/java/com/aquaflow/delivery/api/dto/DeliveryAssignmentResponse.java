package com.aquaflow.delivery.api.dto;

import java.time.Instant;

public record DeliveryAssignmentResponse(
        Long id,
        Long orderId,
        String orderCode,
        String orderStatus,
        String fulfillmentType,
        String recipientName,
        String recipientPhone,
        String deliveryAddress,
        String deliveryArea,
        boolean active,
        Instant assignedAt
) {
}
