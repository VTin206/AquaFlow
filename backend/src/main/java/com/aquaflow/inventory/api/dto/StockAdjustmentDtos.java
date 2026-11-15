package com.aquaflow.inventory.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public final class StockAdjustmentDtos {
    private StockAdjustmentDtos() {
    }

    /** Kiểm kê một lô: nhập số đếm thực tế, hệ thống tự tính chênh lệch với tồn trên sổ. */
    public record Create(
            @NotNull @Positive Long batchId,
            @NotNull @PositiveOrZero Integer countedQuantity,
            @NotBlank @Size(max = 300) String reason) {
        public Create {
            reason = reason == null ? null : reason.trim();
        }
    }

    public record Response(
            long id,
            String code,
            long batchId,
            String lotCode,
            long productId,
            String productName,
            int onHandBefore,
            int countedQuantity,
            int delta,
            String reason,
            long performedBy,
            Instant createdAt) {
    }
}
