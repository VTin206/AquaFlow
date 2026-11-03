import type { Dayjs } from 'dayjs'
import type { OrderInput } from '@/features/live/orderApi'
import type { Customer } from '@/features/customers/types'
import { matchesSearch, phoneDigits } from '@/shared/utils/search'
import { createdAtOf, walkInName, type Order, type OrderDraft } from './types'

/** Giá trị của form nhận đơn, dùng chung cho bản dùng thử và tài khoản thật. */
export type IntakeLine = { productId?: string; quantity?: number }
export type IntakeValues = {
  phone?: string
  customer?: string
  method: Order['method']
  channel: Exclude<Order['channel'], 'Website'>
  address?: string
  area?: string
  appointment?: Dayjs
  lines: IntakeLine[]
  note?: string
}
export type SubmittedLine = { productId: string; quantity: number }

/** Chỉ so khi đủ một số điện thoại, tránh khớp nhầm lúc đang gõ dở. */
export function samePhone(a: string | undefined, b: string | undefined) {
  const key = phoneDigits(a ?? '')
  return key.length >= 10 && key === phoneDigits(b ?? '')
}

/** Đơn gần nhất chưa hủy của khách, theo hồ sơ hoặc số điện thoại (đơn web có thể chưa gắn hồ sơ). */
export function lastOrderOf(orders: Order[], customerId: string | undefined, phone: string | undefined) {
  return orders
    .filter((order) => order.status !== 'Đã hủy' && ((customerId && order.customerId === customerId) || samePhone(order.phone, phone)))
    .sort((a, b) => (createdAtOf(b) ?? '').localeCompare(createdAtOf(a) ?? ''))[0] as Order | undefined
}

/** Gợi ý khi gõ số hoặc tên: khách có hồ sơ trước, rồi đến người từng đặt đơn nhưng chưa có hồ sơ (BE không tự tạo hồ sơ từ đơn). */
export function contactSuggestions(customers: Customer[], orders: Order[], typed: string, limit = 6) {
  const seen = new Set<string>()
  const contacts = [
    ...customers.map(({ name, phone }) => ({ name, phone })),
    ...orders
      .filter((order) => order.status !== 'Đã hủy')
      .map((order) => ({ name: order.customer === walkInName ? '' : order.customer, phone: order.phone })),
  ]
  return contacts
    .filter(({ name, phone }) => {
      const key = phoneDigits(phone)
      if (!key || seen.has(key) || !matchesSearch(typed, `${name} ${phone}`, phone)) return false
      seen.add(key)
      return true
    })
    .slice(0, limit)
    .map(({ name, phone }) => ({ value: phone, label: name ? `${name} · ${phone}` : phone }))
}

/** Mã sản phẩm bán nhiều nhất theo số lượng trên các đơn chưa hủy. */
export function bestSellers(orders: Order[]) {
  const sold = new Map<string, number>()
  for (const order of orders) {
    if (order.status === 'Đã hủy') continue
    for (const line of order.lines) sold.set(line.productId, (sold.get(line.productId) ?? 0) + line.quantity)
  }
  return [...sold.entries()].sort((a, b) => b[1] - a[1]).map(([productId]) => productId)
}

/** Chọn nhanh: sản phẩm đã có thì tăng số lượng, còn dòng trống thì điền vào, không thì thêm dòng. */
export function addQuickLine(lines: IntakeLine[], productId: string): IntakeLine[] {
  if (lines.some((line) => line?.productId === productId))
    return lines.map((line) => (line?.productId === productId ? { ...line, quantity: (line.quantity ?? 0) + 1 } : line))
  const empty = lines.findIndex((line) => !line?.productId)
  if (empty < 0) return [...lines, { productId, quantity: 1 }]
  return lines.map((line, index) => (index === empty ? { productId, quantity: line?.quantity ?? 1 } : line))
}

/** Tên gọn cho nút chọn nhanh, bỏ loại nước ở đầu tên. */
export const shortProductName = (name: string) => name.replace(/^nước\s+(tinh khiết|khoáng)\s+/i, '') || name

const text = (value?: string) => value?.trim() || null
const cleanPhone = (value?: string) => value?.replace(/[\s().-]/g, '') || null
const liveChannels = { 'Tại quầy': 'COUNTER', 'Điện thoại': 'PHONE', 'Tin nhắn': 'MESSAGE' } as const

const submittedLines = (values: IntakeValues) => values.lines as SubmittedLine[]

export function toLiveOrderInput(values: IntakeValues, customerId: string | undefined): OrderInput {
  const delivery = values.method === 'Giao tận nơi'
  return {
    customerId: customerId ? Number(customerId) : null,
    channel: liveChannels[values.channel],
    fulfillmentType: delivery ? 'DELIVERY' : 'COUNTER',
    recipientName: text(values.customer),
    recipientPhone: cleanPhone(values.phone),
    deliveryAddress: delivery ? text(values.address) : null,
    deliveryArea: delivery ? text(values.area) : null,
    requestedDeliveryAt: delivery ? (values.appointment?.toISOString() ?? null) : null,
    items: submittedLines(values).map((line) => ({ productId: Number(line.productId), quantity: line.quantity })),
    note: text(values.note),
  }
}

/** Dữ liệu mẫu tính phí giao thay cho hệ thống, như backend khi tạo đơn. */
export const toDemoOrderDraft = (values: IntakeValues, deliveryFee: number): OrderDraft => ({
  customer: values.customer,
  phone: values.phone,
  address: values.address,
  area: values.area,
  method: values.method,
  channel: values.channel,
  lines: submittedLines(values),
  deliveryFee,
  appointment: values.appointment?.toISOString(),
  note: values.note,
})
