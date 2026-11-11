package com.aquaflow.inventory.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

public record PurchaseReceiptRequest(
        @NotNull(message = "Supplier is required")
        Long supplierId,

        @NotNull(message = "Received time is required")
        Instant receivedAt,

        String note,

        @NotEmpty(message = "Receipt must have at least one item")
        List<@Valid PurchaseItemRequest> items,

        /** Người kiểm nhận hàng tại kho; trống thì không ghi. */
        @Size(max = 150, message = "Receiver name must not exceed 150 characters")
        String receiverName
) {
    public PurchaseReceiptRequest(Long supplierId, Instant receivedAt, String note, List<PurchaseItemRequest> items) {
        this(supplierId, receivedAt, note, items, null);
    }
}
