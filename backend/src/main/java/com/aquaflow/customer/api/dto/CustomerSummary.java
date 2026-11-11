package com.aquaflow.customer.api.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.OffsetDateTime;

/**
 * Hồ sơ khách kèm số liệu cho danh sách và hồ sơ khách: các trường của {@link CustomerResponse}
 * cộng số đơn (không tính đơn hủy), lần mua gần nhất, địa chỉ giao của đơn gần nhất,
 * số còn phải thu, số vỏ và tiền cọc khách đang giữ.
 */
public record CustomerSummary(
        Long id,
        String fullName,
        String phone,
        Instant createdAt,
        String customerType,
        String area,
        String note,
        long orderCount,
        OffsetDateTime lastOrderAt,
        String lastDeliveryAddress,
        BigDecimal due,
        long bottlesHeld,
        BigDecimal depositHeld
) {
}
