package com.aquaflow.customer.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CustomerRequest(

        @NotBlank(message = "Tên khách hàng không được để trống")
        @Size(max = 150, message = "Tên khách hàng không được vượt quá 150 ký tự")
        String fullName,

        @Size(max = 20, message = "Số điện thoại không được vượt quá 20 ký tự")
        String phone

) {
}
