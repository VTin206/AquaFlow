import type { Order, OrderStatus } from './types'

export const orderStatuses: OrderStatus[] = ['Chờ xác nhận', 'Đang chuẩn bị', 'Đang giao', 'Đã giao', 'Giao thất bại', 'Đã hoàn tất', 'Đã hủy']

export const statusColor: Record<OrderStatus, string> = {
  'Chờ xác nhận': 'gold',
  'Đang chuẩn bị': 'blue',
  'Đang giao': 'cyan',
  'Đã giao': 'geekblue',
  'Giao thất bại': 'red',
  'Đã hoàn tất': 'green',
  'Đã hủy': 'default',
}

export const nextActionLabel = (order: Order) => {
  if (order.status === 'Chờ xác nhận') return 'Xác nhận'
  if (order.status === 'Đang chuẩn bị') return order.method === 'Tại quầy' ? 'Khách nhận hàng' : 'Bắt đầu giao'
  if (order.status === 'Đang giao') return 'Kết quả giao'
  if (order.status === 'Giao thất bại') return 'Giao lại'
  return undefined
}
