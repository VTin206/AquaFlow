package com.aquaflow.inventory.application;

import java.time.LocalDate;

public record DispatchedLine(
        Long reservationId,
        Long orderItemId,
        Long productId,
        Long batchId,
        String lotCode,
        LocalDate expiresOn,
        int quantityDispatched,
        int quantityReturned,
        int quantityDamaged,
        int quantityUnreturned) {
}
