package com.aquaflow.inventory.application;

import java.time.LocalDate;

/** Hàng đã xuất kho của một reservation, dùng để đối chiếu khi kiểm tra hàng hoàn. */
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
