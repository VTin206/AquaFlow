package com.aquaflow.delivery.api.dto;

import java.time.LocalDate;

public record DeliveryDispatchLineResponse(

        Long orderItemId,

        Long batchId,

        String lotCode,

        LocalDate expiresOn,

        int quantityLoaded

) {
}
