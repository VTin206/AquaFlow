/** Thông tin cửa hàng in trên hóa đơn, phiếu giao và các ngưỡng cảnh báo. Mô hình demo, chưa phải API contract. */
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
}
