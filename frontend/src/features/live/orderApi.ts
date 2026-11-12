import { api } from '@/shared/api/client'

export const orderStatusLabels = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  PREPARING: 'Đang chuẩn bị',
  OUT_FOR_DELIVERY: 'Đang giao',
  DELIVERED: 'Đã giao',
  COMPLETED: 'Đã hoàn tất',
  CANCELLED: 'Đã hủy',
}
export const paymentStatusLabels = {
  UNPAID: 'Chưa thanh toán',
  PARTIALLY_PAID: 'Thanh toán một phần',
  PAID: 'Đã thanh toán',
  REFUND_PENDING: 'Chờ hoàn tiền',
  REFUNDED: 'Đã hoàn tiền',
}
export const channelLabels = { WEB: 'Website', COUNTER: 'Tại quầy', PHONE: 'Điện thoại', MESSAGE: 'Tin nhắn' }
export type LiveOrder = {
  id: number
  orderCode: string
  customerId: number | null
  createdBy: number | null
  channel: keyof typeof channelLabels
  fulfillmentType: 'COUNTER' | 'DELIVERY'
  status: keyof typeof orderStatusLabels
  paymentStatus: keyof typeof paymentStatusLabels
  recipientName: string | null
  recipientPhone: string | null
  deliveryAddress: string | null
  deliveryArea: string | null
  requestedDeliveryAt: string | null
  subtotal: number
  discountAmount: number
  deliveryFee: number
  total: number
  createdAt: string
  confirmedAt: string | null
  cancelledAt: string | null
  note: string | null
  items: { id: number; productId: number; quantity: number; unitPrice: number; lineTotal: number }[]
  /** Liên kết tra cứu cho khách: /track/{trackingToken}. */
  trackingToken?: string | null
}
export type OrderStatus = LiveOrder['status']
/** Theo OrderCreateRequest; nhân viên không tạo đơn kênh WEB (đơn web đi luồng khách hàng). */
export type OrderInput = {
  customerId: number | null
  channel: Exclude<LiveOrder['channel'], 'WEB'>
  fulfillmentType: LiveOrder['fulfillmentType']
  recipientName: string | null
  recipientPhone: string | null
  deliveryAddress: string | null
  deliveryArea: string | null
  requestedDeliveryAt: string | null
  items: { productId: number; quantity: number }[]
  note: string | null
}

export const confirmOrderHint = 'Hệ thống giữ hàng theo lô có hạn gần nhất. Nếu không đủ hàng khả dụng, đơn vẫn ở trạng thái chờ xác nhận.'

/** Xác nhận/chuẩn bị/hủy theo OrderStatusPolicy; các bước giao hàng thuộc màn hình giao vận. */
export const canConfirm = (order: Pick<LiveOrder, 'status'>) => order.status === 'PENDING'
/** Đơn đã giữ hàng chuyển sang soạn hàng; đơn giao phải ở bước này mới xếp được vào chuyến. */
export const canPrepare = (order: Pick<LiveOrder, 'status'>) => order.status === 'CONFIRMED'
export const canCancel = (order: Pick<LiveOrder, 'status'>) => ['PENDING', 'CONFIRMED', 'PREPARING'].includes(order.status)

/**
 * Một dòng trong danh sách đơn: đơn kèm số đã thu/còn thu từ sổ thanh toán, và cờ lần giao gần nhất thất bại
 * (đơn chưa xong, phân công đang hiệu lực).
 */
export type LiveOrderListItem = LiveOrder & { paid: number; due: number; refundDue: number; lastAttemptFailed?: boolean }

/** Bộ lọc GET /sales/orders; trường bỏ trống là không lọc. */
export type OrderPageQuery = {
  page: number
  size: number
  statuses?: OrderStatus[]
  fulfillment?: LiveOrder['fulfillmentType']
  payment?: 'DUE' | 'SETTLED'
  q?: string
}

export type OrderPage = {
  items: LiveOrderListItem[]
  page: number
  size: number
  total: number
  totalPages: number
  /** Đếm trên toàn bộ đơn, không theo bộ lọc. */
  statusCounts: Partial<Record<OrderStatus, number>>
}

/** Ghép tham số; `status` lặp lại cho từng trạng thái như Spring đọc `Set<OrderStatus>`. */
export const orderPageParams = ({ page, size, statuses, fulfillment, payment, q }: OrderPageQuery) => {
  const params = new URLSearchParams({ page: String(page), size: String(size) })
  for (const status of statuses ?? []) params.append('status', status)
  if (fulfillment) params.set('fulfillment', fulfillment)
  if (payment) params.set('payment', payment)
  if (q?.trim()) params.set('q', q.trim())
  return params
}

/** Số ngày đơn đã xong vẫn nằm trong tập đơn của các màn hình vận hành. */
export const WORKING_SET_DAYS = 30

export const orderApi = {
  page: (query: OrderPageQuery) => api.get<OrderPage>('/sales/orders', { params: orderPageParams(query) }),
  /** Đơn còn việc phải làm cộng đơn tạo trong `days` ngày gần nhất; không phân trang, luôn nhỏ. */
  workingSet: (days = WORKING_SET_DAYS) => api.get<LiveOrderListItem[]>('/sales/orders/working-set', { params: { days } }),
  byCustomer: (customerId: number) => api.get<LiveOrderListItem[]>(`/sales/customers/${customerId}/orders`),
  detail: (id: number) => api.get<LiveOrder>(`/sales/orders/${id}`),
  create: (input: OrderInput) => api.post<LiveOrder>('/sales/orders', input),
  updateStatus: (id: number, status: OrderStatus) => api.patch<LiveOrder>(`/sales/orders/${id}/status`, { status }),
}
