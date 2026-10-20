package com.aquaflow.customer.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CustomerAddressRequest(

        @NotBlank(message = "Tên người nhận không được để trống")
        @Size(max = 150, message = "Tên người nhận không được vượt quá 150 ký tự")
        String recipientName,

        @NotBlank(message = "Số điện thoại người nhận không được để trống")
        @Size(max = 20, message = "Số điện thoại không được vượt quá 20 ký tự")
        String recipientPhone,

        @NotBlank(message = "Địa chỉ giao hàng không được để trống")
        String addressLine,

        @Size(max = 150, message = "Khu vực không được vượt quá 150 ký tự")
        String area

) {
}
