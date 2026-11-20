import { currency } from '@/shared/utils/format'
import { walkInName, type Order } from './types'
import { formatDeliveryWindow } from '@/shared/utils/deliveryWindow'

/**
 * Tin nhắn xác nhận đơn để dán vào Zalo/SMS gửi khách.
 * `depositLabel`: mức cọc theo loại vỏ của đơn (vd "Vỏ 20L 50.000 ₫/vỏ thiếu"), báo trước cho khách không có vỏ đổi.
 */
export function orderConfirmationMessage(order: Order, storeName?: string, depositLabel?: string) {
  const greeting = order.customer && order.customer !== walkInName ? `Chào anh/chị ${order.customer},` : 'Chào anh/chị,'
  return [
    `${greeting} ${storeName ?? 'cửa hàng'} xác nhận đơn ${order.code ?? order.id}:`,
    ...order.lines.map((line) => `- ${line.name} × ${line.quantity}: ${currency(line.quantity * line.unitPrice)}`),
    ...(order.discount ? [`Giảm giá: −${currency(order.discount)}`] : []),
    ...(order.deliveryFee > 0 ? [`Phí giao: ${currency(order.deliveryFee)}`] : []),
    `Tổng cộng: ${currency(order.total)}`,
    ...(depositLabel ? [`Cọc vỏ (chưa gồm trong tổng, chỉ thu khi không có vỏ đổi): ${depositLabel}`] : []),
    ...(order.phone ? [`SĐT: ${order.phone}`] : []),
    order.method === 'Giao tận nơi' ? `Giao đến: ${order.address}` : 'Nhận hàng tại cửa hàng',
    ...(order.appointment ? [`Giờ hẹn: ${formatDeliveryWindow(order.appointment, order.appointmentUntil)}`] : []),
    'Cảm ơn anh/chị đã đặt hàng!',
  ].join('\n')
}
