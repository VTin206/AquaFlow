import { api } from '../../shared/api/client'

export const orderStatusLabels = { PENDING: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận', PREPARING: 'Đang chuẩn bị', OUT_FOR_DELIVERY: 'Đang giao', DELIVERED: 'Đã giao', COMPLETED: 'Đã hoàn tất', CANCELLED: 'Đã hủy' }
export const paymentStatusLabels = { UNPAID: 'Chưa thanh toán', PARTIALLY_PAID: 'Thanh toán một phần', PAID: 'Đã thanh toán', REFUND_PENDING: 'Chờ hoàn tiền', REFUNDED: 'Đã hoàn tiền' }
export const channelLabels = { WEB: 'Website', COUNTER: 'Tại quầy', PHONE: 'Điện thoại', MESSAGE: 'Tin nhắn' }
export type LiveOrder = {
  id: number; orderCode: string; customerId: number | null; createdBy: number | null
  channel: keyof typeof channelLabels; fulfillmentType: 'COUNTER' | 'DELIVERY'
  status: keyof typeof orderStatusLabels; paymentStatus: keyof typeof paymentStatusLabels
  recipientName: string | null; recipientPhone: string | null; deliveryAddress: string | null; deliveryArea: string | null
  requestedDeliveryAt: string | null; subtotal: number; discountAmount: number; deliveryFee: number; total: number
  createdAt: string; confirmedAt: string | null; cancelledAt: string | null; note: string | null
  items: { id: number; productId: number; quantity: number; unitPrice: number; lineTotal: number }[]
}

export const orderApi = {
  list: () => api.get<LiveOrder[]>('/sales/orders'),
  detail: (id: number) => api.get<LiveOrder>(`/sales/orders/${id}`),
}
