package com.aquaflow.delivery.api.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record DeliveryRedeliveryRequest(

        @NotNull(message = "New delivery trip ID is required")
        @Positive(message = "New delivery trip ID must be positive")
        Long newTripId

) {
}
