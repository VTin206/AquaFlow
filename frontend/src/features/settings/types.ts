/**
 * Phí giao hàng, BE dùng cho báo giá ở trang đặt hàng và khi tạo đơn giao tận nơi (không tính theo khoảng cách).
 * `stairsPerJug`: phụ phí mỗi bình theo lầu, phần tử đầu là lầu 1; lầu cao hơn danh sách dùng mức cuối.
 */
export type DeliveryFees = { freeFromUnits: number; smallOrderFee: number; stairsPerJug: number[] }

/** Số lầu có ô nhập riêng trên trang Cài đặt; ô cuối áp dụng cho lầu này trở lên. */
export const STAIR_FLOORS = 4

/** Đủ một ô cho mỗi lầu từ 1 đến STAIR_FLOORS (danh sách ngắn hơn thì lầu cao dùng mức cuối, như BE). */
export const normalizeDeliveryFees = (fees: DeliveryFees): DeliveryFees => ({
  ...fees,
  stairsPerJug: Array.from({ length: STAIR_FLOORS }, (_, index) => fees.stairsPerJug[Math.min(index, fees.stairsPerJug.length - 1)] ?? 0),
})

/** Thông tin cửa hàng in trên hóa đơn, phiếu giao và các ngưỡng cảnh báo. */
export type StoreSettings = {
  storeName: string
  address: string
  phone: string
  email?: string
  /** Giờ mở cửa hiện trên thanh trên cùng của trang khách, ghi tự do (vd. "6:00 – 21:00 hằng ngày"). */
  openingHours?: string
  taxCode?: string
  /** Tài khoản nhận chuyển khoản in cuối hóa đơn. */
  bankName?: string
  bankAccount?: string
  bankHolder?: string
  /** Lời cảm ơn hoặc chính sách ngắn in cuối hóa đơn. */
  invoiceNote?: string
  /** Cảnh báo lô/sản phẩm còn hạn dùng ít hơn số ngày này. */
  expiryWarningDays: number
  /** Ngưỡng tồn tối thiểu gợi ý khi tạo sản phẩm mới. */
  defaultLowStock: number
  /** BE luôn trả (cài đặt cũ dùng mức mặc định); thiếu khi lưu thì BE giữ nguyên mức đang áp dụng. */
  deliveryFees?: DeliveryFees
}
