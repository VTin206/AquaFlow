import { api } from '@/shared/api/client'
import type { OrderStatus, PublicOrder } from '@/features/orders/types'
import { orderStatusLabels, type LiveOrder } from './orderApi'

/** Theo PublicOrderResponse của OrderTrackingController: không có id nội bộ, số điện thoại đã che. */
export type LiveTrackedOrder = {
  orderCode: string
  status: LiveOrder['status']
  fulfillmentType: LiveOrder['fulfillmentType']
  paymentStatus: LiveOrder['paymentStatus']
  deliveryFailed: boolean
  recipientName: string | null
  recipientPhone: string | null
  deliveryAddress: string | null
  deliveryArea: string | null
  requestedDeliveryAt: string | null
  subtotal: number
  discountAmount: number
  deliveryFee: number
  total: number
  paid: number
  due: number
  createdAt: string
  confirmedAt: string | null
  deliveredAt: string | null
  cancelledAt: string | null
  trackingToken: string
  items: { productId: number; productName: string; unit: string; quantity: number; unitPrice: number; lineTotal: number }[]
}

/** Giao thất bại chưa có bước riêng ở BE: đơn vẫn ở trạng thái cũ, kèm cờ deliveryFailed. */
const statusOf = (order: LiveTrackedOrder): OrderStatus => {
  if (order.deliveryFailed && ['OUT_FOR_DELIVERY', 'CONFIRMED'].includes(order.status)) return 'Giao thất bại'
  return orderStatusLabels[order.status] as OrderStatus
}

export const toPublicOrder = (order: LiveTrackedOrder): PublicOrder => ({
  id: order.orderCode,
  customer: order.recipientName ?? '',
  address: [order.deliveryAddress, order.deliveryArea].filter(Boolean).join(', '),
  status: statusOf(order),
  method: order.fulfillmentType === 'COUNTER' ? 'Tại quầy' : 'Giao tận nơi',
  lines: order.items.map((item) => ({
    productId: String(item.productId),
    name: item.productName,
    unit: item.unit,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
  })),
  deliveryFee: order.deliveryFee,
  total: order.total,
  paid: order.paid,
  due: order.due,
  appointment: order.requestedDeliveryAt ?? undefined,
  createdAt: order.createdAt,
  deliveredAt: order.deliveredAt ?? undefined,
  trackingToken: order.trackingToken,
})

export const orderTrackingApi = {
  lookup: async (orderCode: string, phone: string) =>
    toPublicOrder(await api.post<LiveTrackedOrder>('/order-tracking/lookups', { orderCode: orderCode.trim(), phone: phone.trim() })),
  byToken: async (token: string) => toPublicOrder(await api.get<LiveTrackedOrder>(`/order-tracking/${encodeURIComponent(token)}`)),
}
