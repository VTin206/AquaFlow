package com.aquaflow.customer.order.domain;

public enum OrderStatus {
    PENDING,
    CONFIRMED,
    PREPARING,
    OUT_FOR_DELIVERY,
    DELIVERED,
    COMPLETED,
    CANCELLED
}
