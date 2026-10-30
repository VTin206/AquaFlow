package com.aquaflow.inventory.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.List;

public record PurchaseReceiptRequest(
        @NotNull(message = "Supplier is required")
        Long supplierId,

        @NotNull(message = "Received time is required")
        Instant receivedAt,

        String note,

        @NotEmpty(message = "Receipt must have at least one item")
        List<@Valid PurchaseItemRequest> items
) {
}
