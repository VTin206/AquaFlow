package com.aquaflow.inventory.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record PurchaseItemResponse(
        Long id,
        Long productId,
        String productName,
        Long batchId,
        String lotCode,
        LocalDate manufacturedOn,
        LocalDate expiresOn,
        int quantityReceived,
        int quantityAccepted,
        int quantityRejected,
        BigDecimal unitCost
) {
}
