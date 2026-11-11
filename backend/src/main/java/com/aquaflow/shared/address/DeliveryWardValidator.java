package com.aquaflow.shared.address;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class DeliveryWardValidator implements ConstraintValidator<DeliveryWard, String> {
    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        return value == null || value.isBlank() || DeliveryWards.contains(value);
    }
}
