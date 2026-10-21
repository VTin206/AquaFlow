package com.aquaflow.customer.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CustomerRequest(

        @NotBlank(message = "Full name is required")
        @Size(max = 150, message = "Full name must not exceed 150 characters")
        String fullName,

        @NotBlank(message = "Phone is required")
        @Size(max = 20, message = "Phone must not exceed 20 characters")
        @Pattern(
                regexp = "^(0|\\+84)[0-9]{9,10}$",
                message = "Phone must be a valid Vietnamese phone number"
        )
        String phone

) {
}
