import type { Order, OrderStatus } from '@/features/orders/types'
import { localDay } from '@/features/reports/reportService'

const OPEN: OrderStatus[] = ['Chờ xác nhận', 'Đã xác nhận', 'Đang chuẩn bị', 'Đang giao']
const DONE: OrderStatus[] = ['Đã giao', 'Đã hoàn tất']

/**
 * Tiến độ giao trong ngày.
 * - Còn phải giao: đơn giao tận nơi chưa xong, hẹn tới hết hôm nay (kể cả hẹn ngày trước còn sót) hoặc đang trên đường.
 * - Đã giao: đơn giao xong hôm nay. Danh sách đơn của BE chưa có giờ giao nên tạm tính theo ngày hẹn.
 * - Trễ: đơn còn phải giao đã quá giờ hẹn.
 */
export function deliveryToday(orders: Order[], now = new Date()) {
  const today = localDay(now.toISOString())
  const delivery = orders.filter((order) => order.method === 'Giao tận nơi')
  const remaining = delivery
    .filter(
      (order) =>
        OPEN.includes(order.status) &&
        (order.status === 'Đang giao' || (order.appointment !== undefined && localDay(order.appointment) <= today)),
    )
    .sort((a, b) => (a.appointment ?? '9').localeCompare(b.appointment ?? '9'))
  const delivered = delivery.filter((order) => {
    if (!DONE.includes(order.status)) return false
    const at = order.deliveredAt ?? order.appointment
    return at !== undefined && localDay(at) === today
  })
  const isLate = (order: Order) => order.appointment !== undefined && Date.parse(order.appointment) < now.getTime()
  return { remaining, delivered: delivered.length, late: remaining.filter(isLate).length, isLate }
}
