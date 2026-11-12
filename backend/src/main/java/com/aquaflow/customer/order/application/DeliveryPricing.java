package com.aquaflow.customer.order.application;

import com.aquaflow.workspace.api.DeliveryFees;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.Locale;
import java.util.Set;

/** Shared by checkout quotes and order creation. No distance surcharge. Fees come from the store settings. */
public final class DeliveryPricing {
    private DeliveryPricing() {}

    /** Đơn vị phải vác lên lầu từng cái: bình và thùng. Chai, lon lẻ không tính phụ phí thang bộ. */
    private static final Set<String> STAIRS_UNITS = Set.of("binh", "thung");

    /**
     * {@code fees}: mức phí đã dùng để tính, để trang đặt hàng hiện đúng cách tính theo cài đặt cửa hàng.
     * {@code stairsUnits}: số bình/thùng chịu phụ phí thang bộ.
     */
    public record Quote(BigDecimal subtotal, BigDecimal baseFee, BigDecimal stairsFee,
                        BigDecimal deliveryFee, BigDecimal total, DeliveryFees fees) {}

    public static Quote calculate(BigDecimal subtotal, long units, long stairsUnits, int floor) {
        return calculate(subtotal, units, stairsUnits, floor, DeliveryFees.DEFAULT);
    }

    /** {@code fees} null: mức mặc định. {@code stairsUnits}: số bình và thùng trong đơn. */
    public static Quote calculate(BigDecimal subtotal, long units, long stairsUnits, int floor, DeliveryFees fees) {
        if (floor < 0 || floor > 30 || units <= 0 || stairsUnits < 0 || stairsUnits > units)
            throw new IllegalArgumentException("Invalid delivery quantities or stair floor");
        DeliveryFees rules = fees == null ? DeliveryFees.DEFAULT : fees;
        BigDecimal base = BigDecimal.valueOf(units >= rules.freeFromUnits() ? 0 : rules.smallOrderFee());
        BigDecimal stairs = BigDecimal.valueOf(rules.stairsFeePerJug(floor)).multiply(BigDecimal.valueOf(stairsUnits));
        return new Quote(subtotal, base, stairs, base.add(stairs), subtotal.add(base).add(stairs), rules);
    }

    /** Bình hoặc thùng (không phân biệt hoa thường, có dấu hay không): tính phụ phí thang bộ theo từng cái. */
    public static boolean carriesStairsFee(String unit) {
        if (unit == null) return false;
        String plain = Normalizer.normalize(unit.trim(), Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT);
        return STAIRS_UNITS.contains(plain);
    }
}
