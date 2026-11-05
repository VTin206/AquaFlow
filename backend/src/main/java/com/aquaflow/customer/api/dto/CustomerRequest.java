package com.aquaflow.customer.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CustomerRequest(

        @NotBlank(message = "Full name is required")
        @Size(max = 150, message = "Full name must not exceed 150 characters")
        String fullName,

        @Size(max = 20, message = "Phone must not exceed 20 characters")
        @Pattern(
                regexp = "^(0|\\+84)[0-9]{9,10}$",
                message = "Phone must be a valid Vietnamese phone number"
        )
        String phone,

        @Pattern(regexp = "^(Cá nhân|Doanh nghiệp)$", message = "Customer type must be Cá nhân or Doanh nghiệp")
        String customerType,

        @Size(max = 150, message = "Area must not exceed 150 characters")
        String area,

        @Size(max = 1000, message = "Note must not exceed 1000 characters")
        String note
) {
    public CustomerRequest(String fullName, String phone) {
        this(fullName, phone, null, null, null);
    }
}
