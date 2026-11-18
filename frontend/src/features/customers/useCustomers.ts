import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/shared/api/client'
import { useStaff } from '@/features/auth/useStaff'
import { invalidateLiveData } from '@/features/live/invalidateLiveData'
import { customerApi, type CustomerSortField, type LiveCustomerSummary } from '@/features/live/customerApi'
import { initialsOf, type Customer, type CustomerDraft } from './types'
import type { IdleFilter } from './lastOrder'

export const customerKeys = {
  all: ['customers'] as const,
  ledger: (customerId: string) => ['customers', customerId, 'ledger'] as const,
}

// Tài khoản thật: CustomerController; địa chỉ giao quản lý riêng theo từng khách.
type CustomerResponse = {
  id: number
  fullName: string
  phone: string | null
  createdAt: string
  customerType?: Customer['type'] | null
  area?: string | null
  note?: string | null
}

/** Các số dư được bổ sung từ API sổ thanh toán và sổ vỏ. */
const fromResponse = (customer: CustomerResponse, orders: number, debt = 0): Customer => ({
  id: String(customer.id),
  name: customer.fullName,
  phone: customer.phone ?? '',
  type: customer.customerType ?? 'Cá nhân',
  area: customer.area ?? '',
  note: customer.note ?? undefined,
  addresses: [],
  legacyOrders: 0,
  initials: initialsOf(customer.fullName),
  orders,
  bottlesHeld: 0,
  depositHeld: 0,
  debt,
})

/**
 * Số đơn (không tính đơn hủy), lần mua gần nhất, địa chỉ giao của đơn gần nhất, công nợ, vỏ và cọc
 * đều do BE tính trong GET /sales/customers. BE chưa trả địa chỉ mặc định nên dùng địa chỉ đơn gần nhất.
 */
export const fromSummary = (summary: LiveCustomerSummary): Customer => ({
  ...fromResponse({ ...summary, customerType: summary.customerType as Customer['type'] | null }, summary.orderCount, Number(summary.due)),
  lastOrderAt: summary.lastOrderAt ?? undefined,
  mainAddress: summary.lastDeliveryAddress ?? undefined,
  bottlesHeld: summary.bottlesHeld,
  depositHeld: Number(summary.depositHeld),
})

const useLiveKey = () => {
  const staff = useStaff()
  return [staff?.name, staff?.role] as const
}

/** Cột sắp xếp của bảng khách (khóa cột trong bảng) và cột tương ứng ở BE. */
export const customerSortFields = {
  name: 'NAME',
  orders: 'ORDERS',
  lastOrderAt: 'LAST_ORDER',
  debt: 'DEBT',
  bottlesHeld: 'BOTTLES',
} as const satisfies Record<string, CustomerSortField>

export type CustomerSortKey = keyof typeof customerSortFields
export type CustomerSort = { key: CustomerSortKey; order: 'ascend' | 'descend' } | null

/** Lựa chọn sắp xếp của thẻ khách trên điện thoại, ứng với cột sắp xếp gửi lên BE. */
export type CustomerCardSort = 'recent' | 'idle' | 'name' | 'debt' | 'bottles'
export const cardSortOrder: Record<CustomerCardSort, NonNullable<CustomerSort>> = {
  recent: { key: 'lastOrderAt', order: 'descend' },
  idle: { key: 'lastOrderAt', order: 'ascend' },
  name: { key: 'name', order: 'ascend' },
  debt: { key: 'debt', order: 'descend' },
  bottles: { key: 'bottlesHeld', order: 'descend' },
}

/** `sort` rỗng: theo tên A → Z như trước khi có sắp xếp theo cột. */
export type CustomerPageFilters = { query: string; idle: IdleFilter; sort?: CustomerSort }

/** Một trang khách đã chuyển về kiểu giao diện; `totals` cộng trên mọi khách, không theo bộ lọc. */
export type CustomerPageView = {
  customers: Customer[]
  total: number
  totals: { customers: number; due: number; bottlesHeld: number; depositHeld: number }
}

async function liveCustomerPage(filters: CustomerPageFilters, page: number, size: number): Promise<CustomerPageView> {
  const sort = filters.sort
    ? { field: customerSortFields[filters.sort.key], direction: filters.sort.order === 'descend' ? ('DESC' as const) : ('ASC' as const) }
    : undefined
  const result = await customerApi.page({ page, size, q: filters.query, idle: filters.idle, sort })
  return {
    customers: result.items.map(fromSummary),
    total: result.total,
    totals: {
      customers: result.totals.customers,
      due: Number(result.totals.due),
      bottlesHeld: result.totals.bottlesHeld,
      depositHeld: Number(result.totals.depositHeld),
    },
  }
}

/** Trang Khách hàng: tìm/lọc/phân trang ở BE, giữ trang cũ trong lúc tải trang mới. */
export function useCustomerPage(filters: CustomerPageFilters, page: number, size: number) {
  const who = useLiveKey()
  return useQuery({
    queryKey: ['live', 'customers', ...who, 'page', filters, page, size],
    queryFn: () => liveCustomerPage(filters, page, size),
    placeholderData: keepPreviousData,
  })
}

/** Tìm khách theo tên, mã, số điện thoại (ô tìm kiếm chung, gợi ý khi nhận đơn). Từ khóa rỗng thì không tải. */
export function useCustomerSearch(query: string, size = 8) {
  const keyword = query.trim()
  const page = useCustomerPage({ query: keyword, idle: 'all' }, 0, size)
  return keyword ? page : { ...page, data: undefined, isPending: false, isError: false }
}

/** Một khách theo id (hồ sơ khách). */
export function useCustomer(id: string | undefined) {
  const who = useLiveKey()
  return useQuery({
    queryKey: ['live', 'customers', ...who, 'summary', id],
    queryFn: () => customerApi.summary(Number(id)).then(fromSummary),
    enabled: Boolean(id),
  })
}

const useInvalidateCustomers = () => {
  const queryClient = useQueryClient()
  return () => Promise.all([invalidateLiveData(queryClient), queryClient.invalidateQueries({ queryKey: customerKeys.all })])
}

// Chuỗi rỗng để BE xóa khu vực/ghi chú cũ; null là giữ nguyên.
const toRequest = (draft: CustomerDraft) => ({
  fullName: draft.name.trim(),
  phone: draft.phone?.replace(/[\s().-]/g, '') || null,
  customerType: draft.type,
  area: draft.area?.trim() ?? '',
  note: draft.note?.trim() ?? '',
})

/** Thêm mới khi không có `id`, cập nhật khi có. */
export function useSaveCustomer() {
  const invalidate = useInvalidateCustomers()
  return useMutation({
    mutationFn: async ({ id, draft }: { id?: string; draft: CustomerDraft }): Promise<Customer> => {
      const saved = id
        ? await api.put<CustomerResponse>(`/sales/customers/${id}`, toRequest(draft))
        : await api.post<CustomerResponse>('/sales/customers', toRequest(draft))
      return fromResponse(saved, 0)
    },
    onSuccess: () => void invalidate(),
  })
}

export function useDeactivateCustomer() {
  const invalidate = useInvalidateCustomers()
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/sales/customers/${id}`),
    onSuccess: () => void invalidate(),
  })
}

/** Khách đã lưu trữ (GET /sales/customers/archived). Bảng chỉ hiện tên, số điện thoại, khu vực nên không cần số đơn. */
export function useArchivedCustomers() {
  const liveKey = useLiveKey()
  return useQuery({
    queryKey: [...customerKeys.all, 'archived', liveKey],
    queryFn: async () =>
      (await api.get<CustomerResponse[]>('/sales/customers/archived')).map((customer) => fromResponse(customer, 0)),
  })
}

/** Khôi phục hồ sơ. BE từ chối (409) khi số điện thoại đã thuộc một khách đang hoạt động. */
export function useActivateCustomer() {
  const invalidate = useInvalidateCustomers()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.post<CustomerResponse>(`/sales/customers/${id}/reactivate`)
    },
    onSuccess: () => void invalidate(),
  })
}
