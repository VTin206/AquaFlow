package com.aquaflow.shared.address;

import java.text.Normalizer;
import java.util.Set;

/**
 * Phường/xã cửa hàng giao hàng: 102 đơn vị mới (78 phường, 24 xã) nằm trên địa bàn TP. Hồ Chí Minh cũ, tức 168 đơn vị
 * của TP. Hồ Chí Minh sau sắp xếp 01/7/2025 trừ phần nhập từ Bình Dương và Bà Rịa - Vũng Tàu (Nghị quyết 1685/NQ-UBTVQH15).
 * Giữ khớp với {@code deliveryWards} trong frontend/src/shared/address/hcmWards.ts.
 */
public final class DeliveryWards {
    public static final Set<String> ALL = Set.of(
            "Phường An Đông", "Phường An Hội Đông", "Phường An Hội Tây", "Phường An Khánh", "Phường An Lạc",
            "Phường An Nhơn", "Phường An Phú Đông", "Phường Bàn Cờ", "Phường Bảy Hiền", "Phường Bến Thành",
            "Phường Bình Đông", "Phường Bình Hưng Hòa", "Phường Bình Lợi Trung", "Phường Bình Phú", "Phường Bình Quới",
            "Phường Bình Tân", "Phường Bình Tây", "Phường Bình Thạnh", "Phường Bình Thới", "Phường Bình Tiên",
            "Phường Bình Trị Đông", "Phường Bình Trưng", "Phường Cát Lái", "Phường Cầu Kiệu", "Phường Cầu Ông Lãnh",
            "Phường Chánh Hưng", "Phường Chợ Lớn", "Phường Chợ Quán", "Phường Diên Hồng", "Phường Đông Hưng Thuận",
            "Phường Đức Nhuận", "Phường Gia Định", "Phường Gò Vấp", "Phường Hạnh Thông", "Phường Hiệp Bình",
            "Phường Hòa Bình", "Phường Hòa Hưng", "Phường Khánh Hội", "Phường Linh Xuân", "Phường Long Bình",
            "Phường Long Phước", "Phường Long Trường", "Phường Minh Phụng", "Phường Nhiêu Lộc", "Phường Phú Định",
            "Phường Phú Lâm", "Phường Phú Nhuận", "Phường Phú Thạnh", "Phường Phú Thọ", "Phường Phú Thọ Hòa",
            "Phường Phú Thuận", "Phường Phước Long", "Phường Sài Gòn", "Phường Tam Bình", "Phường Tăng Nhơn Phú",
            "Phường Tân Bình", "Phường Tân Định", "Phường Tân Hòa", "Phường Tân Hưng", "Phường Tân Mỹ",
            "Phường Tân Phú", "Phường Tân Sơn", "Phường Tân Sơn Hòa", "Phường Tân Sơn Nhất", "Phường Tân Sơn Nhì",
            "Phường Tân Tạo", "Phường Tân Thới Hiệp", "Phường Tân Thuận", "Phường Tây Thạnh", "Phường Thạnh Mỹ Tây",
            "Phường Thông Tây Hội", "Phường Thới An", "Phường Thủ Đức", "Phường Trung Mỹ Tây", "Phường Vĩnh Hội",
            "Phường Vườn Lài", "Phường Xóm Chiếu", "Phường Xuân Hòa", "Xã An Nhơn Tây", "Xã An Thới Đông",
            "Xã Bà Điểm", "Xã Bình Chánh", "Xã Bình Hưng", "Xã Bình Khánh", "Xã Bình Lợi",
            "Xã Bình Mỹ", "Xã Cần Giờ", "Xã Củ Chi", "Xã Đông Thạnh", "Xã Hiệp Phước",
            "Xã Hóc Môn", "Xã Hưng Long", "Xã Nhà Bè", "Xã Nhuận Đức", "Xã Phú Hòa Đông",
            "Xã Tân An Hội", "Xã Tân Nhựt", "Xã Tân Vĩnh Lộc", "Xã Thái Mỹ", "Xã Thạnh An",
            "Xã Vĩnh Lộc", "Xã Xuân Thới Sơn"
    );

    private DeliveryWards() {}

    public static boolean contains(String ward) {
        return ward != null && ALL.contains(Normalizer.normalize(ward.trim(), Normalizer.Form.NFC));
    }
}
