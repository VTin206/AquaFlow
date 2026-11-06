package com.aquaflow.customer.order.application;

import java.math.BigDecimal;

/** Shared by checkout quotes and order creation. No distance surcharge. */
public final class DeliveryPricing {
    private DeliveryPricing() {}

    public record Quote(BigDecimal subtotal, BigDecimal baseFee, BigDecimal stairsFee,
                        BigDecimal deliveryFee, BigDecimal total) {}

    public static Quote calculate(BigDecimal subtotal, long units, long jugs, int floor) {
        if (floor < 0 || floor > 30 || units <= 0 || jugs < 0 || jugs > units)
            throw new IllegalArgumentException("Invalid delivery quantities or stair floor");
        BigDecimal base = BigDecimal.valueOf(units >= 3 ? 0 : 15000);
        long perJug = floor <= 2 ? 2000L * floor : floor == 3 ? 8000 : 12000;
        BigDecimal stairs = BigDecimal.valueOf(perJug).multiply(BigDecimal.valueOf(jugs));
        return new Quote(subtotal, base, stairs, base.add(stairs), subtotal.add(base).add(stairs));
    }

    public static boolean isJug(String unit) {
        return "Bình".equalsIgnoreCase(unit) || "binh".equalsIgnoreCase(unit);
    }
}
