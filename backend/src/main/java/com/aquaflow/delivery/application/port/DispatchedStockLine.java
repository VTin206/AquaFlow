package com.aquaflow.delivery.application.port;

import java.time.LocalDate;

public record DispatchedStockLine(

        Long reservationId,

        Long orderItemId,

        Long productId,

        Long batchId,

        String lotCode,

        LocalDate expiresOn,

        int quantityDispatched,

        int quantityReturned,

        int quantityDamaged,

        int quantityUnreturned

) {
}
