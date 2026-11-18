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
  /** Kèm số đã trả và còn phải trả của đơn (view order_payment_balances). */
  detail: (id: number) => api.get<LiveOrder & { paid?: number; due?: number }>(`/customer/orders/${id}`),
  /** Khách tự hủy khi đơn còn chờ xác nhận; đơn đã xác nhận thì backend trả 409. */
  cancel: (id: number) => api.post<LiveOrder>(`/customer/orders/${id}/cancel`),
  create: (draft: GuestOrderInput) => api.post<LiveOrder>('/customer/orders', { ...draft, channel: 'WEB', fulfillmentType: 'DELIVERY' }),
}
