package com.aquaflow.auth.api.dto;

import jakarta.validation.constraints.*;

/** Public registration never accepts a role, status or existing customer id. */
public record RegisterRequest(
        @NotBlank @Size(max = 150) String fullName,
        @NotBlank @Email @Size(max = 150) String email,
        @NotBlank @Pattern(regexp = "^(?:0\\d{9,10}|\\+?84\\d{9,10})$") String phone,
        @NotBlank @Size(min = 8, max = 128) String password) {
    public RegisterRequest {
        if (fullName != null) fullName = fullName.trim();
        if (email != null) email = email.trim();
        if (phone != null) phone = phone.trim();
    }
}
