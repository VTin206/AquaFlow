import { api } from '@/shared/api/client'
import type { LiveOrder } from './orderApi'

export type DispatchReceipt = {
  id: number
  orderId: number
  performedBy: number
  dispatchedAt: string
  orderStatus: 'OUT_FOR_DELIVERY' | 'DELIVERED'
  items: { orderItemId: number; productId: number; batchId: number; lotCode: string; expiresOn: string; quantity: number }[]
}

export const canDispatch = (order: Pick<LiveOrder, 'status' | 'fulfillmentType'>) =>
  order.status === 'PREPARING' && order.fulfillmentType === 'DELIVERY'

export const dispatchApi = {
  create: (orderId: number) => api.post<DispatchReceipt>(`/sales/orders/${orderId}/dispatches`),
  list: (orderId: number) => api.get<DispatchReceipt[]>(`/sales/orders/${orderId}/dispatches`),
  detail: (orderId: number, id: number) => api.get<DispatchReceipt>(`/sales/orders/${orderId}/dispatches/${id}`),
}
