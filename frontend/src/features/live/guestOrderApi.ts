import { api } from '@/shared/api/client'
import type { LiveOrder, PaymentMethod } from './orderApi'

/** Payload công khai cho checkout; giá và customerId do backend quyết định. */
export type GuestOrderInput = {
  recipientName: string
  recipientPhone: string
  deliveryAddress: string
  deliveryArea: string
  items: { productId: number; quantity: number }[]
  requestedDeliveryAt?: string
  /** Cuối khung giờ khách chọn. */
  requestedDeliveryUntil?: string
  note?: string
  stairFloor?: number
  expectedTotal?: number
  /** Cách khách chọn trả tiền ở bước đặt (docs/ORDER_PAYMENT_METHOD_API.md); backend cũ bỏ qua trường này. */
  paymentMethod?: PaymentMethod
}

export const guestOrderApi = {
  create: (input: GuestOrderInput) => api.post<LiveOrder>('/customer/orders/guest', input),
}
