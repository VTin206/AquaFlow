import { jugCount, knownAmountDue, orderedAtOf, type Order } from '@/features/orders/types'
import type { WaitingOrder } from './components/WaitingOrdersCard'
import type { AvailableOrder } from './deliveryApi'

/** Đơn chờ xếp chuyến từ BE, bổ sung số bình, tiền cần thu và giờ hẹn từ danh sách đơn (nếu có). */
export const toWaitingOrder = (item: AvailableOrder, order?: Order): WaitingOrder => ({
  id: String(item.id),
  code: item.orderCode,
  customer: item.recipientName || order?.customer || 'Khách hàng',
  address: item.deliveryAddress ?? '',
  appointment: order?.appointment,
  appointmentUntil: order?.appointmentUntil,
  jugs: order ? jugCount(order) : 0,
  units: order ? order.lines.reduce((sum, line) => sum + line.quantity, 0) : 0,
  due: order ? knownAmountDue(order) : null,
  redelivery: item.redeliveryEligible,
  orderedAt: order ? orderedAtOf(order) : undefined,
})
