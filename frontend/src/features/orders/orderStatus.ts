import { awaitingReturnInspection, type Order, type OrderStatus } from './types'

export const orderStatuses: OrderStatus[] = ['Chờ xác nhận', 'Đã xác nhận', 'Đang chuẩn bị', 'Đang giao', 'Đã giao', 'Giao thất bại', 'Đã hoàn tất', 'Đã hủy']

/** Bản dùng thử xác nhận là chuyển thẳng sang chuẩn bị; BE có bước "Đã xác nhận" và chưa có "Giao thất bại". */
export const statusesFor = (demo: boolean) => orderStatuses.filter((status) => (demo ? status !== 'Đã xác nhận' : status !== 'Giao thất bại'))

export const statusColor: Record<OrderStatus, string> = {
  'Chờ xác nhận': 'gold',
  'Đã xác nhận': 'blue',
  'Đang chuẩn bị': 'blue',
  'Đang giao': 'cyan',
  'Đã giao': 'geekblue',
  'Giao thất bại': 'red',
  'Đã hoàn tất': 'green',
  'Đã hủy': 'default',
}

export const nextActionLabel = (order: Order) => {
  if (order.status === 'Chờ xác nhận') return 'Xác nhận'
  // Đơn giao tận nơi chỉ xuất kho qua chuyến giao (Giao hàng → chi tiết chuyến).
  if (order.status === 'Đang chuẩn bị') return order.method === 'Tại quầy' ? 'Khách nhận hàng' : undefined
  if (order.status === 'Đang giao') return 'Kết quả giao'
  if (order.status === 'Giao thất bại') return awaitingReturnInspection(order) ? undefined : 'Giao lại'
  return undefined
}
