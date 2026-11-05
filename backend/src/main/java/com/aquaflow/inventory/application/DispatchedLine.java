package com.aquaflow.inventory.application;

import java.time.LocalDate;

public record DispatchedLine(Long orderItemId, Long productId, Long batchId,
                             String lotCode, LocalDate expiresOn, int quantity) {
}
