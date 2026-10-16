package com.aquaflow.auth.api.dto;

public record UserResponse(
        Long id,
        String fullName,
        String email,
        String phone,
        String role,
        String status
) {
}
