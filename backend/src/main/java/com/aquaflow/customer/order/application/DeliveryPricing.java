package com.aquaflow.customer.order.application;

import com.aquaflow.workspace.api.DeliveryFees;

import java.math.BigDecimal;

/** Shared by checkout quotes and order creation. No distance surcharge. Fees come from the store settings. */
public final class DeliveryPricing {
    private DeliveryPricing() {}

    public record Quote(BigDecimal subtotal, BigDecimal baseFee, BigDecimal stairsFee,
                        BigDecimal deliveryFee, BigDecimal total) {}

    public static Quote calculate(BigDecimal subtotal, long units, long jugs, int floor) {
        return calculate(subtotal, units, jugs, floor, DeliveryFees.DEFAULT);
    }

    /** {@code fees} null: mức mặc định. */
    public static Quote calculate(BigDecimal subtotal, long units, long jugs, int floor, DeliveryFees fees) {
        if (floor < 0 || floor > 30 || units <= 0 || jugs < 0 || jugs > units)
            throw new IllegalArgumentException("Invalid delivery quantities or stair floor");
        DeliveryFees rules = fees == null ? DeliveryFees.DEFAULT : fees;
        BigDecimal base = BigDecimal.valueOf(units >= rules.freeFromUnits() ? 0 : rules.smallOrderFee());
        BigDecimal stairs = BigDecimal.valueOf(rules.stairsFeePerJug(floor)).multiply(BigDecimal.valueOf(jugs));
        return new Quote(subtotal, base, stairs, base.add(stairs), subtotal.add(base).add(stairs));
    }

    public static boolean isJug(String unit) {
        return "Bình".equalsIgnoreCase(unit) || "binh".equalsIgnoreCase(unit);
    }
}
