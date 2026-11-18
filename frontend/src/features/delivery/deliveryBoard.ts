import type { Order, OrderStatus } from '@/features/orders/types'

export type BoardGroup = { status: OrderStatus; title: string; hint: string; color: string }

/** Việc gấp nhất lên đầu (giao thất bại), các nhóm sau theo thứ tự quy trình. */
export const boardGroups: BoardGroup[] = [
  { status: 'Giao thất bại', title: 'Giao thất bại', hint: 'Kiểm hàng hoàn ở Kho hàng rồi giao lại', color: '#c34444' },
  { status: 'Chờ xác nhận', title: 'Chờ xác nhận', hint: 'Gọi lại cho khách để xác nhận', color: '#f59f00' },
  { status: 'Đã xác nhận', title: 'Đã xác nhận', hint: 'Đã giữ hàng, chuyển sang soạn hàng', color: '#4263eb' },
  { status: 'Đang chuẩn bị', title: 'Đang chuẩn bị', hint: 'Xếp vào chuyến, xuất kho ở chi tiết chuyến', color: '#1c7ed6' },
  { status: 'Đang giao', title: 'Đang giao', hint: 'Xác nhận khi khách đã nhận hàng', color: '#0b7a83' },
]

const COLLAPSED_KEY = 'af.deliveryBoard.collapsed'

/** Nhóm người dùng đã đóng, nhớ theo trình duyệt; không đọc được (chế độ riêng tư, dữ liệu hỏng) thì mở hết. */
export function readCollapsed(): OrderStatus[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]')
    const known = new Set<string>(boardGroups.map((group) => group.status))
    return Array.isArray(value) ? value.filter((item): item is OrderStatus => typeof item === 'string' && known.has(item)) : []
  } catch {
    return []
  }
}

export function writeCollapsed(statuses: OrderStatus[]) {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(statuses))
  } catch {
    // Không lưu được thì chỉ mất ghi nhớ, bảng vẫn đóng/mở bình thường.
  }
}

/**
 * Chia đơn giao tận nơi theo nhóm trạng thái, mỗi nhóm xếp theo giờ hẹn (chưa hẹn xuống cuối).
 * BE giữ đơn giao thất bại ở OUT_FOR_DELIVERY và chỉ ghi kết quả trên chuyến, nên `failed` (mã đơn có lần giao gần nhất thất bại)
 * chuyển đơn "Đang giao" sang nhóm "Giao thất bại".
 */
export function groupDeliveries(orders: Order[], failed: Set<string>) {
  const groupOf = (order: Order): OrderStatus => (order.status === 'Đang giao' && failed.has(order.id) ? 'Giao thất bại' : order.status)
  const deliveries = orders
    .filter((order) => order.method === 'Giao tận nơi')
    .sort((a, b) => (a.appointment ?? '9').localeCompare(b.appointment ?? '9'))
  return boardGroups.map((group) => ({ ...group, orders: deliveries.filter((order) => groupOf(order) === group.status) }))
}
