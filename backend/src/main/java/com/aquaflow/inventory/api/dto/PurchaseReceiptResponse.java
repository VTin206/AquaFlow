package com.aquaflow.inventory.api.dto;

import com.aquaflow.inventory.domain.PurchaseReceiptStatus;

import java.time.Instant;
import java.util.List;

public record PurchaseReceiptResponse(
        Long id,
        Long supplierId,
        String supplierName,
        PurchaseReceiptStatus status,
        Instant receivedAt,
        Long createdBy,
        Long confirmedBy,
        Instant confirmedAt,
        String note,
        List<PurchaseItemResponse> items,
        String receiverName
) {
    public PurchaseReceiptResponse(Long id, Long supplierId, String supplierName, PurchaseReceiptStatus status, Instant receivedAt,
                                   Long createdBy, Long confirmedBy, Instant confirmedAt, String note, List<PurchaseItemResponse> items) {
        this(id, supplierId, supplierName, status, receivedAt, createdBy, confirmedBy, confirmedAt, note, items, null);
    }
}
