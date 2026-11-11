package com.aquaflow.customer.order.api.dto;

import com.fasterxml.jackson.annotation.JsonUnwrapped;

import java.math.BigDecimal;

/**
 * Một dòng trong danh sách đơn: các trường của {@link OrderResponse} (trải phẳng trong JSON)
 * cùng số tiền đã thu/còn thu từ view order_payment_balances, để frontend không phải tải toàn bộ bảng công nợ.
 */
public record OrderListItem(
        @JsonUnwrapped OrderResponse order,
        BigDecimal paid,
        BigDecimal due,
        BigDecimal refundDue
) {
}
