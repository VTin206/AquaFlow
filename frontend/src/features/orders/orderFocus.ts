import type { LiveOrder } from '@/features/live/orderApi'
import { currency } from '@/shared/utils/format'
import { amountDue, awaitingReturnInspection, type Order } from './types'

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

/** Đơn của bản dùng thử: có thêm trạng thái giao thất bại và số tiền còn phải thu. */
export function demoOrderFocus(order: Order): OrderFocus {
  const due = amountDue(order)
  if (awaitingReturnInspection(order)) {
    return { tone: 'alert', title: 'Chờ kiểm hàng hoàn', description: 'Kiểm hàng mang về ở Kho hàng → Hàng hoàn, xong mới giao lại hoặc hủy đơn.' }
  }
  switch (order.status) {
    case 'Giao thất bại':
      return { tone: 'alert', title: 'Giao thất bại', description: 'Hàng mang về đã kiểm. Giao lại hoặc hủy đơn.' }
    case 'Chờ xác nhận':
      return { tone: 'action', title: 'Cần xác nhận đơn', description: 'Kiểm tra thông tin với khách rồi xác nhận để giữ hàng trong kho.' }
    case 'Đã xác nhận':
    case 'Đang chuẩn bị':
      return order.method === 'Giao tận nơi'
        ? { tone: 'action', title: 'Cần xếp vào chuyến giao', description: 'Đơn đã sẵn sàng để giao.' }
        : { tone: 'action', title: 'Chờ khách nhận tại quầy', description: 'Hàng đang được giữ cho khách.' }
    case 'Đang giao':
      return {
        tone: 'waiting',
        title: 'Đang giao cho khách',
        description: 'Muốn hủy đơn: tài xế ghi "Giao thất bại", kho kiểm hàng mang về rồi mới hủy được.',
      }
    case 'Đã hủy':
      return { tone: 'muted', title: 'Đơn đã hủy' }
    default:
      return due > 0
        ? { tone: 'action', title: `Còn phải thu ${currency(due)}`, description: 'Khách đã nhận hàng nhưng chưa thu đủ tiền.' }
        : { tone: 'done', title: order.status === 'Đã hoàn tất' ? 'Đơn đã hoàn tất' : 'Khách đã nhận hàng' }
  }
}
