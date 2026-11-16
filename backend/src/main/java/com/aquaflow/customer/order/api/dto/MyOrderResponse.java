package com.aquaflow.customer.order.api.dto;

import com.fasterxml.jackson.annotation.JsonUnwrapped;

import java.math.BigDecimal;

/**
 * Chi tiết đơn của khách: các trường của {@link OrderResponse} cộng số đã trả và còn phải trả
 * (từ view order_payment_balances), để trang đơn không phải gọi thêm API tra cứu bằng mã theo dõi.
 */
public final class MyOrderResponse {
    private final OrderResponse order;
    private final BigDecimal paid;
    private final BigDecimal due;

    public MyOrderResponse(OrderResponse order, BigDecimal paid, BigDecimal due) {
        this.order = order; this.paid = paid; this.due = due;
    }

    @JsonUnwrapped public OrderResponse getOrder() { return order; }
    public BigDecimal getPaid() { return paid; }
    public BigDecimal getDue() { return due; }
}
