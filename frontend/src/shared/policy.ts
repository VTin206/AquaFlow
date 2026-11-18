// Chính sách mẫu tham khảo các bài công khai của iWater (iwater.vn, chính sách áp dụng từ 2016):
// - "Phí đặt cọc vỏ bình dành cho khách hàng sử dụng lần đầu"
// - "Chính sách giao hàng nước bình 20L khách hàng mới sử dụng lần đầu cần lưu ý"
// Đây là cấu hình demo, cửa hàng cần xác nhận lại trước khi dùng thật.

/** Khách chưa có vỏ để đổi: tiền thế chân mỗi vỏ, tính riêng ngoài tiền nước. */
export const DEPOSIT_PER_BOTTLE = 50_000

/** Miễn phí giao trong bán kính 5 km khi đơn từ 3 bình/thùng; ít hơn thu 15.000–25.000 ₫ tùy khoảng cách. */
export const FREE_DELIVERY_MIN_UNITS = 3
export const SMALL_ORDER_FEE = { min: 15_000, max: 25_000 }

/** Phí cơ bản: đơn đủ số lượng được miễn. */
export const smallOrderFee = (units: number) => (units >= FREE_DELIVERY_MIN_UNITS ? 0 : SMALL_ORDER_FEE.min)
