import { api } from '@/shared/api/client'
import type { LiveOrder } from './orderApi'

/** Payload công khai cho checkout; giá và customerId do backend quyết định. */
export type GuestOrderInput = {
  recipientName: string
  recipientPhone: string
  deliveryAddress: string
  deliveryArea: string
  items: { productId: number; quantity: number }[]
  note?: string
}

export const guestOrderApi = {
  create: (input: GuestOrderInput) => api.post<LiveOrder>('/customer/orders/guest', input),
}
