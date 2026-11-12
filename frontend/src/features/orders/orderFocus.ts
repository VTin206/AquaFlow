import type { LiveOrder } from '@/features/live/orderApi'

/** Điều quan trọng nhất của đơn lúc này: `action` cần người dùng làm, `alert` có sự cố, còn lại chỉ để biết. */
export type OrderFocus = { tone: 'action' | 'alert' | 'waiting' | 'done' | 'muted'; title: string; description?: string }

/** Đơn thật. `failureReason`: lần giao gần nhất thất bại (null nếu thất bại mà không ghi lý do, undefined nếu không thất bại). */
export function liveOrderFocus(
  order: Pick<LiveOrder, 'status' | 'fulfillmentType' | 'paymentStatus'>,
  failureReason?: string | null,
  /** Đơn đang giao mà không thuộc chuyến nào, ví dụ đơn xuất kho từ trước khi có chuyến giao. */
  withoutTrip = false,
): OrderFocus {
  const open = !['DELIVERED', 'COMPLETED', 'CANCELLED'].includes(order.status)
  if (open && failureReason !== undefined) {
    return { tone: 'alert', title: 'Lần giao gần nhất thất bại', description: failureReason ?? 'Tài xế không ghi lý do.' }
  }
  switch (order.status) {
    case 'PENDING':
      return { tone: 'action', title: 'Cần xác nhận đơn', description: 'Kiểm tra thông tin với khách rồi xác nhận để giữ hàng trong kho.' }
    case 'CONFIRMED':
      return { tone: 'action', title: 'Cần soạn hàng', description: 'Hàng đã được giữ trong kho.' }
    case 'PREPARING':
      return order.fulfillmentType === 'DELIVERY'
        ? { tone: 'action', title: 'Cần xếp vào chuyến giao', description: 'Quản lý xuất kho cả chuyến ở trang Giao hàng.' }
        : { tone: 'action', title: 'Chờ bàn giao tại quầy', description: 'Kiểm tra đủ hàng rồi xác nhận bàn giao khi khách nhận hàng.' }
    case 'OUT_FOR_DELIVERY':
      if (withoutTrip) {
        return { tone: 'alert', title: 'Đơn đang giao nhưng không thuộc chuyến nào', description: 'Chưa ghi được kết quả giao cho đơn này. Hãy báo quản trị kiểm tra.' }
      }
      return { tone: 'waiting', title: 'Đang giao cho khách', description: 'Chờ tài xế ghi kết quả giao hàng.' }
    case 'CANCELLED':
      return { tone: 'muted', title: 'Đơn đã hủy' }
    default:
      return {
        tone: 'done',
        title: order.status === 'COMPLETED' ? 'Đơn đã hoàn tất' : 'Khách đã nhận hàng',
        description: order.paymentStatus === 'UNPAID' || order.paymentStatus === 'PARTIALLY_PAID' ? 'Đơn chưa thu đủ tiền.' : undefined,
      }
  }
}
