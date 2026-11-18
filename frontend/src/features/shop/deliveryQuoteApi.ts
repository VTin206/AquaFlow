import { api } from '@/shared/api/client'
import type { DeliveryFees } from '@/features/settings/types'

/** `fees`: mức phí cửa hàng đang áp dụng, dùng để giải thích cách tính. */
export type DeliveryQuote = {
  subtotal: number
  baseFee: number
  stairsFee: number
  deliveryFee: number
  total: number
  fees?: DeliveryFees
}
export const deliveryQuoteApi = {
  quote: (items: { productId: number; quantity: number }[], stairFloor: number) =>
    api.post<DeliveryQuote>('/delivery-quotes', { items, stairFloor }),
}
