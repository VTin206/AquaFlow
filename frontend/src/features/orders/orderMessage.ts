import { currency } from '@/shared/utils/format'
import { walkInName, type Order } from './types'

/** Tin nhắn xác nhận đơn để dán vào Zalo/SMS gửi khách. */
export function orderConfirmationMessage(order: Order, storeName?: string) {
  const greeting = order.customer && order.customer !== walkInName ? `Chào anh/chị ${order.customer},` : 'Chào anh/chị,'
  return [
    `${greeting} ${storeName ?? 'cửa hàng'} xác nhận đơn ${order.code ?? order.id}:`,
    ...order.lines.map((line) => `- ${line.name} × ${line.quantity}: ${currency(line.quantity * line.unitPrice)}`),
    ...(order.discount ? [`Giảm giá: −${currency(order.discount)}`] : []),
    ...(order.deliveryFee > 0 ? [`Phí giao: ${currency(order.deliveryFee)}`] : []),
    `Tổng cộng: ${currency(order.total)}`,
    order.method === 'Giao tận nơi' ? `Giao đến: ${order.address}` : 'Nhận hàng tại cửa hàng',
    ...(order.appointment ? [`Giờ hẹn: ${new Date(order.appointment).toLocaleString('vi-VN')}`] : []),
    'Cảm ơn anh/chị đã đặt hàng!',
  ].join('\n')
}
