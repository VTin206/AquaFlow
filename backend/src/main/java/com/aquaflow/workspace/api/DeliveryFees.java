package com.aquaflow.workspace.api;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Phí giao hàng của cửa hàng, dùng cho báo giá ở trang đặt hàng và khi tạo đơn giao tận nơi. Không tính theo khoảng cách.
 *
 * @param freeFromUnits    đơn từ số bình/thùng này trở lên được miễn phí giao
 * @param smallOrderFee    phí giao của đơn ít hơn mức trên (đồng)
 * @param stairsPerJug     phụ phí thang bộ cho mỗi bình theo lầu: phần tử đầu là lầu 1; lầu cao hơn danh sách dùng mức cuối
 */
public record DeliveryFees(
        @NotNull @Min(0) @Max(1000) Integer freeFromUnits,
        @NotNull @Min(0) @Max(10_000_000) Integer smallOrderFee,
        @NotNull @Size(min = 1, max = 10) List<@NotNull @Min(0) @Max(1_000_000) Integer> stairsPerJug) {

    /** Mức đang áp dụng trước khi cửa hàng tự chỉnh: miễn phí từ 3 bình/thùng, đơn nhỏ 15.000 ₫, lầu 1–4+ 2.000/4.000/8.000/12.000 ₫/bình. */
    public static final DeliveryFees DEFAULT = new DeliveryFees(3, 15_000, List.of(2_000, 4_000, 8_000, 12_000));

    public DeliveryFees {
        if (stairsPerJug != null) stairsPerJug = List.copyOf(stairsPerJug);
    }

    /** Phụ phí cho mỗi bình khi giao lên lầu {@code floor}; tầng trệt (0) không tính. */
    @JsonIgnore
    public int stairsFeePerJug(int floor) {
        if (floor <= 0) return 0;
        return stairsPerJug.get(Math.min(floor, stairsPerJug.size()) - 1);
    }
}
