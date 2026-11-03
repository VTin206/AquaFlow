import { api } from '@/shared/api/client'

export type DeliveryAttempt = {
  id: number
  attemptNo: number
  outcome: 'SUCCESS' | 'FAILED'
  recipientName: string | null
  failureReason: string | null
  note: string | null
  attemptedAt: string
}
export type DeliveryStop = {
  id: number
  orderId: number
  orderCode: string
  orderStatus: string
  recipientName: string | null
  recipientPhone: string | null
  deliveryAddress: string | null
  latestAttempt: DeliveryAttempt | null
  items: { productId: number; productName: string; unit: string; lotCode: string; quantity: number }[]
}
export type SettlementInput = {
  cashReported: number
  cashConfirmed: number
  bottlesExpected: number
  bottlesConfirmed: number
  note?: string
}
export type DeliveryTrip = {
  id: number
  driverId: number | null
  driverName: string | null
  vehicle: string | null
  status: 'CREATED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  createdAt: string
  startedAt: string | null
  endedAt: string | null
  createdBy: number
  orders: DeliveryStop[]
  settlement: (SettlementInput & { id: number; receivedBy: number; handedOverAt: string }) | null
}
export type ResultInput = { outcome: 'SUCCESS' | 'FAILED'; recipientName?: string; failureReason?: string; note?: string }
export const tripLabels = { CREATED: 'Chờ khởi hành', IN_PROGRESS: 'Đang giao', COMPLETED: 'Đã đối soát', CANCELLED: 'Đã hủy' }
const base = '/delivery/trips'
export const deliveryApi = {
  list: () => api.get<DeliveryTrip[]>(base),
  detail: (id: number) => api.get<DeliveryTrip>(`${base}/${id}`),
  drivers: () => api.get<{ id: number; name: string }[]>('/delivery/drivers'),
  available: () =>
    api.get<{ id: number; orderCode: string; recipientName: string | null; deliveryAddress: string | null; deliveryFailed: boolean }[]>(
      '/delivery/available-orders',
    ),
  create: (input: { driverId?: number; vehicle?: string }) => api.post<DeliveryTrip>(base, input),
  assign: (id: number, driverId: number) => api.put<DeliveryTrip>(`${base}/${id}/driver`, { driverId }),
  add: (id: number, orderId: number) => api.post<DeliveryStop>(`${base}/${id}/orders`, { orderId }),
  remove: (id: number, orderId: number) => api.delete<DeliveryTrip>(`${base}/${id}/orders/${orderId}`),
  depart: (id: number) => api.put<DeliveryTrip>(`${base}/${id}/departure`),
  cancel: (id: number) => api.patch<DeliveryTrip>(`${base}/${id}`, { status: 'CANCELLED' }),
  result: (id: number, orderId: number, input: ResultInput) => api.post<DeliveryAttempt>(`${base}/${id}/orders/${orderId}/attempts`, input),
  attempts: (id: number, orderId: number) => api.get<DeliveryAttempt[]>(`${base}/${id}/orders/${orderId}/attempts`),
  settle: (id: number, input: SettlementInput) => api.put<DeliveryTrip>(`${base}/${id}/settlement`, input),
}
