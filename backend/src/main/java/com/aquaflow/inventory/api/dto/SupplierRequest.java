package com.aquaflow.inventory.api.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record SupplierRequest(
        @NotBlank(message = "Name is required")
        @Size(max = 200, message = "Name must not exceed 200 characters")
        String name,

        @Size(max = 20, message = "Phone must not exceed 20 characters")
        @Pattern(regexp = "^(0|\\+84)[0-9]{9,10}$", message = "Phone must be a valid Vietnamese phone number")
        String phone,

        @Size(max = 500, message = "Address must not exceed 500 characters")
        String address,

        @Size(max = 150, message = "Contact name must not exceed 150 characters")
        String contactName,

        @Email(message = "Email must be valid")
        @Size(max = 254, message = "Email must not exceed 254 characters")
        String email
) {
    public SupplierRequest(String name, String phone, String address) {
        this(name, phone, address, null, null);
    }
}