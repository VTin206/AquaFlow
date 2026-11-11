import { api } from '@/shared/api/client'

export type LiveCustomer = {
  id: number
  fullName: string
  phone: string | null
  createdAt: string
  customerType?: string | null
  area?: string | null
  note?: string | null
}
export type LiveAddress = {
  id: number
  customerId: number
  recipientName: string
  recipientPhone: string
  addressLine: string
  area: string | null
  isDefault: boolean
}

/** GET /sales/customers và /sales/customers/{id}: hồ sơ kèm số liệu tính ở BE. */
export type LiveCustomerSummary = LiveCustomer & {
  orderCount: number
  lastOrderAt: string | null
  lastDeliveryAddress: string | null
  due: number
  bottlesHeld: number
  depositHeld: number
}

export type CustomerIdleFilter = 'all' | '7' | '14' | '30' | 'never'

export type CustomerSortField = 'NAME' | 'ORDERS' | 'LAST_ORDER' | 'DEBT' | 'BOTTLES'

export type CustomerPageQuery = {
  page: number
  size: number
  q?: string
  idle?: CustomerIdleFilter
  /** Bỏ trống: theo tên A → Z. */
  sort?: { field: CustomerSortField; direction: 'ASC' | 'DESC' }
}

export type CustomerPage = {
  items: LiveCustomerSummary[]
  page: number
  size: number
  total: number
  totalPages: number
  /** Cộng trên mọi khách đang hoạt động, không theo bộ lọc. */
  totals: { customers: number; due: number; bottlesHeld: number; depositHeld: number }
}

export const customerApi = {
  page: ({ page, size, q, idle, sort }: CustomerPageQuery) =>
    api.get<CustomerPage>('/sales/customers', {
      params: {
        page,
        size,
        ...(q?.trim() ? { q: q.trim() } : {}),
        ...(idle && idle !== 'all' ? { idle } : {}),
        ...(sort ? { sort: sort.field, direction: sort.direction } : {}),
      },
    }),
  summary: (id: number) => api.get<LiveCustomerSummary>(`/sales/customers/${id}`),
  addresses: (customerId: number) => api.get<LiveAddress[]>(`/sales/customers/${customerId}/addresses`),
}
