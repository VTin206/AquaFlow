// Chính sách mẫu tham khảo các bài công khai của iWater (iwater.vn, chính sách áp dụng từ 2016):
// - "Phí đặt cọc vỏ bình dành cho khách hàng sử dụng lần đầu"
// - "Chính sách giao hàng nước bình 20L khách hàng mới sử dụng lần đầu cần lưu ý"
// Đây là cấu hình demo, cửa hàng cần xác nhận lại trước khi dùng thật.

/** Khách chưa có vỏ để đổi: tiền thế chân mỗi vỏ, tính riêng ngoài tiền nước. */
export const DEPOSIT_PER_BOTTLE = 50_000

/** Vỏ của các thương hiệu này được đổi bù 1:1 (cùng dung tích), không phải đặt cọc. */
export const EXCHANGEABLE_BRANDS = ['LaVie', 'Viva', 'ion Life', 'Bidrico', 'Vĩnh Hảo', 'Vihawa', 'Satori', 'Top', 'ion Gold']

/** Thu hồi vỏ tận nơi dưới 10 vỏ tính phí mỗi lần; từ 10 vỏ thỏa thuận riêng. */
export const PICKUP_FEE = 30_000
export const PICKUP_FEE_BELOW = 10

/** Miễn phí giao trong bán kính 5 km khi đơn từ 3 bình/thùng; ít hơn thu 15.000–25.000 ₫ tùy khoảng cách. */
export const FREE_DELIVERY_MIN_UNITS = 3
export const SMALL_ORDER_FEE = { min: 15_000, max: 25_000 }

/** Phụ thu thang bộ cho mỗi bình: lầu 1–2 là 2.000 ₫/bình/lầu, lầu 3 là 8.000 ₫/bình, lầu 4 là 12.000 ₫/bình. */
export function stairsSurcharge(floor: number, jugs: number) {
  if (floor <= 0 || jugs <= 0) return 0
  const perJug = floor <= 2 ? 2_000 * floor : floor === 3 ? 8_000 : 12_000
  return perJug * jugs
}

/** Phí giao gợi ý; người bán vẫn quyết định số thực thu. */
export function suggestedDeliveryFee({ units, jugs, floor }: { units: number; jugs: number; floor: number }) {
  return (units >= FREE_DELIVERY_MIN_UNITS ? 0 : SMALL_ORDER_FEE.min) + stairsSurcharge(floor, jugs)
}
