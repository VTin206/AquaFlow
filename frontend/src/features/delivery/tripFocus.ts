import type { OrderFocus } from '@/features/orders/orderFocus'
import type { DeliveryTrip } from './deliveryApi'
import type { TripStatus } from './types'

export type TripViewStatus = TripStatus | 'Đã hủy'
/** Bước tiếp theo của chuyến, cũng là nút chính duy nhất ở chân ngăn kéo. */
export type TripNext = 'addOrders' | 'assignDriver' | 'dispatch' | 'depart' | 'settle'

/** Đưa trạng thái BE về cùng cách gọi với bản dùng thử; đã có kết quả đủ các điểm thì chờ đối soát. */
export function liveTripStatus(trip: Pick<DeliveryTrip, 'status' | 'orders'>): TripViewStatus {
  if (trip.status === 'CANCELLED') return 'Đã hủy'
  if (trip.status === 'COMPLETED') return 'Đã đối soát'
  if (trip.status === 'CREATED') return 'Chờ xuất phát'
  return trip.orders.length > 0 && trip.orders.every((order) => order.latestAttempt) ? 'Chờ đối soát' : 'Đang giao'
}

/** Theo thứ tự BE yêu cầu: có đơn → có tài xế → xuất kho → khởi hành → có kết quả đủ các điểm → đối soát. */
export function liveTripFocus(trip: Pick<DeliveryTrip, 'status' | 'driverId' | 'orders'>): { focus: OrderFocus; next?: TripNext } {
  const total = trip.orders.length
  if (trip.status === 'CANCELLED') return { focus: { tone: 'muted', title: 'Chuyến đã hủy' } }
  if (trip.status === 'COMPLETED') return { focus: { tone: 'done', title: 'Chuyến đã đối soát xong' } }
  if (trip.status === 'CREATED') {
    if (!total) return { next: 'addOrders', focus: { tone: 'action', title: 'Cần thêm đơn vào chuyến', description: 'Chuyến chưa có đơn nào.' } }
    if (!trip.driverId) {
      return { next: 'assignDriver', focus: { tone: 'action', title: 'Cần phân tài xế', description: 'Phải có tài xế mới xuất kho được.' } }
    }
    const preparing = trip.orders.filter((order) => order.orderStatus === 'PREPARING').length
    if (preparing) {
      return {
        next: 'dispatch',
        focus: { tone: 'action', title: `Cần xuất kho ${preparing} đơn`, description: 'Xuất kho xong thì tài xế mới khởi hành được.' },
      }
    }
    if (trip.orders.some((order) => order.orderStatus !== 'OUT_FOR_DELIVERY')) {
      return { focus: { tone: 'alert', title: 'Có đơn không còn đủ điều kiện lên chuyến', description: 'Bỏ các đơn đó khỏi chuyến để tiếp tục.' } }
    }
    return { next: 'depart', focus: { tone: 'action', title: 'Sẵn sàng khởi hành', description: 'Đã xuất kho đủ đơn. Xác nhận khi tài xế đã nhận hàng.' } }
  }
  // Xuất kho từng đơn nên chuyến có thể đã chạy mà vẫn còn đơn chưa xuất.
  const undispatched = trip.orders.filter((order) => order.orderStatus === 'PREPARING').length
  if (undispatched) {
    return { next: 'dispatch', focus: { tone: 'action', title: `Cần xuất kho ${undispatched} đơn`, description: 'Đơn đã xuất không bỏ khỏi chuyến được.' } }
  }
  const results = trip.orders.filter((order) => order.latestAttempt).length
  const failed = trip.orders.filter((order) => order.latestAttempt?.outcome === 'FAILED').length
  const failedNote = failed ? `${failed} đơn giao thất bại.` : ''
  if (results < total) {
    return {
      focus: {
        tone: 'waiting',
        title: `Đã có kết quả ${results}/${total} điểm giao`,
        description: `${failedNote} Ghi đủ kết quả rồi mới đối soát được.`.trim(),
      },
    }
  }
  return {
    next: 'settle',
    focus: { tone: 'action', title: 'Cần đối soát với tài xế', description: `Đã có kết quả đủ ${total} điểm. ${failedNote}`.trim() },
  }
}

type DriverFocusInput = {
  stage: 'preparing' | 'delivering' | 'settled' | 'cancelled'
  total: number
  /** Số điểm chưa có kết quả. */
  pending: number
  waitingDispatch: number
  nextCustomer?: string
}

/** Việc tiếp theo của tài xế; dùng chung cho bản dùng thử và tài khoản thật. */
export function driverTripFocus({ stage, total, pending, waitingDispatch, nextCustomer }: DriverFocusInput): OrderFocus {
  if (stage === 'cancelled') return { tone: 'muted', title: 'Chuyến đã hủy' }
  if (stage === 'settled') return { tone: 'done', title: 'Chuyến đã đối soát xong' }
  if (!total) return { tone: 'waiting', title: 'Chuyến chưa có đơn', description: 'Cửa hàng đang xếp đơn vào chuyến.' }
  if (waitingDispatch > 0) {
    return { tone: 'waiting', title: `Chờ cửa hàng xuất kho ${waitingDispatch} đơn`, description: 'Nhận hàng tại cửa hàng sau khi nhân viên xuất kho.' }
  }
  if (stage === 'preparing') return { tone: 'action', title: 'Nhận đủ hàng rồi bắt đầu chuyến' }
  if (pending === 0) return { tone: 'action', title: 'Về cửa hàng đối soát', description: 'Đã có kết quả tất cả điểm giao. Bàn giao tiền và vỏ.' }
  return { tone: 'action', title: `Điểm tiếp theo: ${nextCustomer}`, description: `Còn ${pending}/${total} điểm chưa có kết quả.` }
}
