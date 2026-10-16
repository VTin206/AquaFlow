import type { OrderStatus } from './types'

export const orderStatuses: OrderStatus[] = ['Chờ xác nhận', 'Đang chuẩn bị', 'Đang giao', 'Đã hoàn tất']

export const statusColor: Record<OrderStatus, string> = {
  'Chờ xác nhận': 'gold',
  'Đang chuẩn bị': 'blue',
  'Đang giao': 'cyan',
  'Đã hoàn tất': 'green',
}

/** Nhãn của nút chuyển sang bước tiếp theo; đơn đã hoàn tất thì không còn bước nào. */
export const nextActionLabel: Partial<Record<OrderStatus, string>> = {
  'Chờ xác nhận': 'Xác nhận',
  'Đang chuẩn bị': 'Bắt đầu giao',
  'Đang giao': 'Hoàn tất',
}

export const nextStatus: Record<OrderStatus, OrderStatus> = {
  'Chờ xác nhận': 'Đang chuẩn bị',
  'Đang chuẩn bị': 'Đang giao',
  'Đang giao': 'Đã hoàn tất',
  'Đã hoàn tất': 'Đã hoàn tất',
}
