import dayjs, { type Dayjs } from 'dayjs'

/**
 * Khung giờ giao khách chọn khi đặt hàng (cố định, không theo giờ mở cửa).
 * Đơn lưu đầu khung ở requestedDeliveryAt và cuối khung ở requestedDeliveryUntil; đơn cũ chỉ có một mốc giờ.
 */
export const DELIVERY_SLOTS = [
  { key: 'morning', label: 'Sáng', start: 8, end: 11 },
  { key: 'noon', label: 'Trưa', start: 11, end: 14 },
  { key: 'afternoon', label: 'Chiều', start: 14, end: 17 },
  { key: 'evening', label: 'Tối', start: 17, end: 20 },
] as const

export type DeliverySlotKey = (typeof DELIVERY_SLOTS)[number]['key']

const pad = (hour: number) => `${String(hour).padStart(2, '0')}:00`

/** "Chiều 14:00–17:00". */
export const slotText = (slot: (typeof DELIVERY_SLOTS)[number]) => `${slot.label} ${pad(slot.start)}–${pad(slot.end)}`

/** Đầu và cuối khung trong ngày đã chọn. */
export function slotWindow(date: Dayjs, key: DeliverySlotKey) {
  const slot = DELIVERY_SLOTS.find((item) => item.key === key)!
  const day = date.startOf('day')
  return { from: day.hour(slot.start), until: day.hour(slot.end) }
}

/** Khung đã bắt đầu thì không chọn được nữa (cửa hàng cần thời gian chuẩn bị). */
export const slotStarted = (date: Dayjs, key: DeliverySlotKey, now: Dayjs = dayjs()) => !slotWindow(date, key).from.isAfter(now)

/** Ngày và khung của đơn đang có, để mở form sửa đơn; giờ không khớp khung nào thì undefined. */
export function slotOf(at?: string | null, until?: string | null): { date: Dayjs; key: DeliverySlotKey } | undefined {
  if (!at || !until) return undefined
  const from = dayjs(at)
  const end = dayjs(until)
  const slot = DELIVERY_SLOTS.find(
    (item) => from.hour() === item.start && from.minute() === 0 && end.hour() === item.end && end.minute() === 0 && end.isSame(from, 'day'),
  )
  return slot ? { date: from.startOf('day'), key: slot.key } : undefined
}

/** Hạn giao để tính trễ: cuối khung nếu có, không thì mốc hẹn. */
export const deliveryDeadline = (at?: string | null, until?: string | null) => until || at || undefined

const clock = (iso: string) => dayjs(iso).format('HH:mm')

/** Thêm "–17:00" sau nhãn kết thúc bằng giờ bắt đầu ("Mai 14:00") khi đơn hẹn theo khung. */
export const withWindowEnd = (label: string, until?: string | null) =>
  until && /\d{2}:\d{2}$/.test(label) ? `${label}–${clock(until)}` : label

/** Giờ hẹn đầy đủ: "14:00–17:00 19/11/2026" cho khung, mốc giờ cũ giữ dạng vi-VN như trước. */
export function formatDeliveryWindow(at: string, until?: string | null) {
  return until ? `${clock(at)}–${clock(until)} ${dayjs(at).format('DD/MM/YYYY')}` : new Date(at).toLocaleString('vi-VN')
}

/** Giờ hẹn gọn: "14:00–17:00 19/11" cho khung, mốc giờ "14:00 19/11". */
export function formatDeliveryWindowShort(at: string, until?: string | null) {
  return `${withWindowEnd(clock(at), until)} ${dayjs(at).format('DD/MM')}`
}
