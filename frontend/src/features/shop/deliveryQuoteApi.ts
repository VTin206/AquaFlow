import { api } from '@/shared/api/client'

export type DeliveryQuote = { subtotal: number; baseFee: number; stairsFee: number; deliveryFee: number; total: number }
export const deliveryQuoteApi = {
  quote: (items: { productId: number; quantity: number }[], stairFloor: number) =>
    api.post<DeliveryQuote>('/delivery-quotes', { items, stairFloor }),
}
