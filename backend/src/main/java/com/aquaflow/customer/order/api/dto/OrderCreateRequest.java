package com.aquaflow.customer.order.api.dto;

import com.aquaflow.customer.order.domain.FulfillmentType;
import com.aquaflow.customer.order.domain.OrderChannel;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.List;

public record OrderCreateRequest(

        @Positive(message = "Customer ID must be positive")
        Long customerId,

        @NotNull(message = "Order channel is required")
        OrderChannel channel,

        @NotNull(message = "Fulfillment type is required")
        FulfillmentType fulfillmentType,

        @Size(max = 150, message = "Recipient name must not exceed 150 characters")
        String recipientName,

        @Pattern(
                regexp = "^(0|\\+84)[0-9]{9,10}$",
                message = "Recipient phone must be a valid Vietnamese phone number"
        )
        String recipientPhone,

        String deliveryAddress,

        @Size(max = 150, message = "Delivery area must not exceed 150 characters")
        String deliveryArea,

        OffsetDateTime requestedDeliveryAt,

        @NotEmpty(message = "Order must contain at least one item")
        List<@NotNull @Valid OrderItemRequest> items,

        String note

) {
}
