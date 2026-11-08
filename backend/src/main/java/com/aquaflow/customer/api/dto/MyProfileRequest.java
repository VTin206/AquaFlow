package com.aquaflow.customer.api.dto;

import jakarta.validation.constraints.*;

public record MyProfileRequest(
        @NotBlank @Size(max = 150) String fullName,
        @NotBlank @Pattern(regexp = "^(?:0\\d{9,10}|\\+84\\d{9,10})$") String phone) {
    public MyProfileRequest {
        if (fullName != null) fullName = fullName.trim();
        if (phone != null) phone = phone.trim().replaceAll("[\\s().-]", "");
    }
}
