import { api, ApiError } from '@/shared/api/client'
import type { LiveOrder } from '@/features/live/orderApi'
import type { GuestOrderInput } from '@/features/live/guestOrderApi'

export const customerOrderApi = {
  list: async () => {
    try {
      return await api.get<LiveOrder[]>('/customer/orders')
    } catch (error) {
      // The current controller returns 404 if this account has no customer profile yet.
      if (error instanceof ApiError && error.status === 404) return []
      throw error
    }
  },
  detail: (id: number) => api.get<LiveOrder>(`/customer/orders/${id}`),
  create: (draft: GuestOrderInput) => api.post<LiveOrder>('/customer/orders', { ...draft, channel: 'WEB', fulfillmentType: 'DELIVERY' }),
}
