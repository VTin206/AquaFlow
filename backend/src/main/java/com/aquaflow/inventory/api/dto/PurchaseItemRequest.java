package com.aquaflow.inventory.api.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

public record PurchaseItemRequest(
        @NotNull(message = "Product is required")
        Long productId,

        @NotBlank(message = "Lot code is required")
        @Size(max = 100, message = "Lot code must not exceed 100 characters")
        String lotCode,

        LocalDate manufacturedOn,

        @NotNull(message = "Expiry date is required")
        LocalDate expiresOn,

        @NotNull(message = "Received quantity is required")
        @Min(value = 1, message = "Received quantity must be greater than 0")
        Integer quantityReceived,

        @NotNull(message = "Accepted quantity is required")
        @Min(value = 0, message = "Accepted quantity must not be negative")
        Integer quantityAccepted,

        @NotNull(message = "Unit cost is required")
        @DecimalMin(value = "0", message = "Unit cost must not be negative")
        BigDecimal unitCost
) {
}
