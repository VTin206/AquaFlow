package com.aquaflow.customer.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CustomerAddressRequest(

        @NotBlank(message = "Recipient name is required")
        @Size(max = 150, message = "Recipient name must not exceed 150 characters")
        String recipientName,

        @NotBlank(message = "Recipient phone is required")
        @Size(max = 20, message = "Recipient phone must not exceed 20 characters")
        @Pattern(
                regexp = "^(0|\\+84)[0-9]{9,10}$",
                message = "Recipient phone must be a valid Vietnamese phone number"
        )
        String recipientPhone,

        @NotBlank(message = "Address line is required")
        String addressLine,

        @Size(max = 150, message = "Area must not exceed 150 characters")
        String area,

        Boolean isDefault

) {
    public CustomerAddressRequest(
            String recipientName,
            String recipientPhone,
            String addressLine,
            String area) {

        this(
                recipientName,
                recipientPhone,
                addressLine,
                area,
                null);
    }
}
