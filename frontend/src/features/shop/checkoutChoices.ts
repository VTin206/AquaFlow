/** Nơi khách nhận hàng: tài xế mang lên tận phòng (tính phí thang bộ) hoặc để ở cổng/sảnh. */
export type DeliveryPlace = 'room' | 'gate'
/** Cách khách muốn trả tiền. Chuyển khoản trước: mã QR hiện ở trang theo dõi đơn sau khi cửa hàng xác nhận giá. */
export type PaymentChoice = 'cod' | 'transfer'

/** Vỏ bình: khách có vỏ cùng loại để đổi, hoặc chưa có vỏ nên đặt cọc vỏ mới (tài xế thu cọc khi giao). */
export type ShellChoice = 'exchange' | 'deposit'

export const SHELL_CHOICES: { value: ShellChoice; label: string }[] = [
  { value: 'exchange', label: 'Có vỏ đổi' },
  { value: 'deposit', label: 'Chưa có vỏ, cọc vỏ mới' },
]

export const DELIVERY_PLACES: { value: DeliveryPlace; label: string }[] = [
  { value: 'room', label: 'Giao tận phòng' },
  { value: 'gate', label: 'Giao tới cổng, sảnh' },
]

export const PAYMENT_CHOICES: { value: PaymentChoice; label: string }[] = [
  { value: 'cod', label: 'Trả khi nhận hàng' },
  { value: 'transfer', label: 'Chuyển khoản trước' },
]

const placeNote: Record<DeliveryPlace, string> = { room: 'Giao tận phòng', gate: 'Giao tới cổng/sảnh' }

/** Độ dài tối đa của ghi chú đơn ở backend. */
export const ORDER_NOTE_MAX = 500
/** Chừa chỗ cho dòng lựa chọn ở đầu ghi chú. */
export const CUSTOMER_NOTE_MAX = 440

/** Số tầng gửi đi để tính phí: giao ở cổng/sảnh thì không đi thang bộ. */
export const stairFloors = (place: DeliveryPlace, floor: number) => (place === 'gate' ? 0 : floor)

/**
 * Backend chưa có trường riêng cho nơi nhận, vỏ bình và cách trả tiền, nên ghi lựa chọn vào đầu ghi chú đơn để nhân
 * viên và tài xế thấy (ghi chú hiện trên đơn và phiếu in). Có vỏ đổi và trả khi nhận hàng là mặc định nên không ghi.
 */
export function checkoutNote(place: DeliveryPlace, payment: PaymentChoice, note?: string, shells?: ShellChoice) {
  const parts = [
    placeNote[place],
    shells === 'deposit' ? 'Chưa có vỏ, cọc vỏ mới' : undefined,
    payment === 'transfer' ? 'Muốn chuyển khoản trước' : undefined,
    note?.trim() || undefined,
  ]
  return parts.filter(Boolean).join(' · ').slice(0, ORDER_NOTE_MAX)
}
