import { api } from '@/shared/api/client'

export type LiveCustomer = { id: number; fullName: string; phone: string | null; createdAt: string; customerType?: string | null; area?: string | null; note?: string | null }
export type LiveAddress = { id: number; customerId: number; recipientName: string; recipientPhone: string; addressLine: string; area: string | null; isDefault: boolean }

export const customerApi = {
  list: () => api.get<LiveCustomer[]>('/sales/customers'),
  addresses: (customerId: number) => api.get<LiveAddress[]>(`/sales/customers/${customerId}/addresses`),
}
