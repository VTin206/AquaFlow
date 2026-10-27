package com.aquaflow.inventory.api.dto;

import java.time.LocalDate;

public record BatchStockResponse(
        Long batchId,
        String lotCode,
        LocalDate expiresOn,
        boolean expired,
        int onHand,
        int reserved,
        // Lô hết hạn luôn có available = 0 vì không được bán
        int available
) {
}
