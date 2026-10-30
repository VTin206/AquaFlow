package com.aquaflow.delivery.api.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record CreateDeliveryAssignmentRequest(
        @NotNull @Positive Long orderId
) {
}
