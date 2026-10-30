package com.aquaflow.inventory.api.dto;

import java.util.List;

public record ProductStockResponse(
        Long productId,
        String sku,
        String productName,
        // Tồn thực tế trong kho, kể cả lô hết hạn chưa xử lý
        int onHand,
        int reserved,
        // Có thể bán = tổng (onHand - reserved) của các lô còn hạn
        int available,
        int expiredOnHand,
        List<BatchStockResponse> batches
) {
}
