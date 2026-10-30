package com.aquaflow.delivery.api.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record CreateDeliveryTripRequest(
        @NotNull @Positive Long driverId
) {
}
