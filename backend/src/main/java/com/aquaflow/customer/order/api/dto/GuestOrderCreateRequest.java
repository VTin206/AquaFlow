package com.aquaflow.customer.order.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.List;

public record GuestOrderCreateRequest(

        @NotBlank(message = "Recipient name is required")
        @Size(max = 150, message = "Recipient name must not exceed 150 characters")
        String recipientName,

        @NotBlank(message = "Recipient phone is required")
        @Pattern(
                regexp = "^(0|\\+84)[0-9]{9,10}$",
                message = "Recipient phone must be a valid Vietnamese phone number"
        )
        String recipientPhone,

        @NotBlank(message = "Delivery address is required")
        String deliveryAddress,

        @Size(max = 150, message = "Delivery area must not exceed 150 characters")
        String deliveryArea,

        OffsetDateTime requestedDeliveryAt,

        @NotEmpty(message = "Order must contain at least one item")
        List<@NotNull @Valid OrderItemRequest> items,

        @Size(max = 500, message = "Note must not exceed 500 characters")
        String note
) {
}
