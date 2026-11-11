package com.aquaflow.shared.address;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** Phường/xã phải thuộc khu vực giao ({@link DeliveryWards}). Bỏ trống vẫn hợp lệ; trường bắt buộc thì thêm {@code @NotBlank}. */
@Documented
@Constraint(validatedBy = DeliveryWardValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT, ElementType.TYPE_USE})
@Retention(RetentionPolicy.RUNTIME)
public @interface DeliveryWard {
    String message() default "Chỉ giao trong khu vực TP. Hồ Chí Minh cũ, vui lòng chọn lại phường/xã";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
