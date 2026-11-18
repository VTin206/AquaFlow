package com.aquaflow.customer.api.dto;

import com.aquaflow.shared.address.DeliveryWard;
import jakarta.validation.constraints.*;

public record MyAddressRequest(
        @NotBlank @Size(max = 150) String recipientName,
        @NotBlank @Pattern(regexp = "^(?:0\\d{9,10}|\\+84\\d{9,10})$") String recipientPhone,
        @NotBlank @Size(max = 255) String addressLine,
        @NotBlank @Size(max = 150) @DeliveryWard String area,
        Boolean isDefault) {
    public MyAddressRequest {
        if (recipientName != null) recipientName = recipientName.trim();
        if (recipientPhone != null) recipientPhone = recipientPhone.trim().replaceAll("[\\s().-]", "");
        if (addressLine != null) addressLine = addressLine.trim();
        if (area != null) area = area.trim();
    }
    public CustomerAddressRequest asAddressRequest() {
        return new CustomerAddressRequest(recipientName, recipientPhone.replaceFirst("^\\+84", "0"), addressLine, area, isDefault);
    }
}
