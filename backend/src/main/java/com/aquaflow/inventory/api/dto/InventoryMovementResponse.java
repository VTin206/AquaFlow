package com.aquaflow.inventory.api.dto;

import com.aquaflow.inventory.domain.MovementType;
import com.aquaflow.inventory.domain.MovementReferenceType;
import java.time.Instant;
import java.time.LocalDate;

public record InventoryMovementResponse(Long id, MovementType type, int quantity, int signedQuantity,
        Instant occurredAt, Long productId, String productName, String sku, String unit,
        Long batchId, String lotCode, LocalDate expiresOn, MovementReferenceType referenceType,
        Long referenceId, String referenceCode, Long performedBy, String performedByName, String reason) {
}
