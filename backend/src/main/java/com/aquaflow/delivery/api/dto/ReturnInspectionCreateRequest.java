package com.aquaflow.delivery.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.util.List;

public record ReturnInspectionCreateRequest(

        @NotEmpty(message = "Return inspection lines are required")
        List<@NotNull @Valid Line> lines,

        @Size(max = 2000, message = "Note must not exceed 2000 characters")
        String note

) {

    public record Line(

            @NotNull(message = "Load item ID is required")
            @Positive(message = "Load item ID must be positive")
            Long loadItemId,

            @NotNull(message = "Resellable quantity is required")
            @Min(0)
            Integer quantityResellable,

            @NotNull(message = "Damaged quantity is required")
            @Min(0)
            Integer quantityDamaged,

            @Size(max = 1000)
            String note

    ) {
    }
}
