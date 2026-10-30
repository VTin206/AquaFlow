package com.aquaflow.delivery.api.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/** Trip currently has no editable business fields other than its assigned driver. */
public record UpdateDeliveryTripRequest(
        @NotNull @Positive Long driverId
) {
}
