package com.aquaflow.delivery.api.dto;

import java.time.OffsetDateTime;
import java.util.List;

public record ReturnInspectionResponse(

        Long id,

        Long attemptId,

        Long assignmentId,

        Long inspectedBy,

        OffsetDateTime inspectedAt,

        String note,

        List<Line> lines

) {

    public record Line(

            Long id,

            Long loadItemId,

            int quantityResellable,

            int quantityDamaged,

            String note

    ) {
    }
}
