import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../shared/api/client'
import { useIsDemo } from '../../shared/features'
import { useStaff } from '../auth/useStaff'
import { customerApi } from '../live/customerApi'
import { invalidateLiveData } from '../live/invalidateLiveData'
import { orderApi } from '../live/orderApi'
import { customerService } from './customerService'
import { initialsOf, type BottleAction, type Customer, type CustomerDraft } from './types'

export const customerKeys = {
  all: ['customers'] as const,
  ledger: (customerId: string) => ['customers', customerId, 'ledger'] as const,
}

// Tài khoản thật: CustomerController; địa chỉ giao quản lý riêng theo từng khách.
type CustomerResponse = {
  id: number; fullName: string; phone: string | null; createdAt: string
  customerType?: Customer['type'] | null; area?: string | null; note?: string | null
}

/** Sổ vỏ, công nợ BE chưa có nên để giá trị trung tính; giao diện ẩn chúng qua `useFeature`. */
const fromResponse = (customer: CustomerResponse, orders: number): Customer => ({
  id: String(customer.id), name: customer.fullName, phone: customer.phone ?? '', type: customer.customerType ?? 'Cá nhân', area: customer.area ?? '',
  note: customer.note ?? undefined, addresses: [],
  legacyOrders: 0, initials: initialsOf(customer.fullName), orders, bottlesHeld: 0, depositHeld: 0, debt: 0,
})

/** Số đơn tính từ đơn thật (không tính đơn đã hủy). */
async function liveCustomers() {
  const [customers, orders] = await Promise.all([api.get<CustomerResponse[]>('/sales/customers'), orderApi.list()])
  const counts = new Map<number, number>()
  for (const order of orders) if (order.customerId !== null && order.status !== 'CANCELLED') counts.set(order.customerId, (counts.get(order.customerId) ?? 0) + 1)
  return customers.map((customer) => fromResponse(customer, counts.get(customer.id) ?? 0))
}

const useLiveKey = () => {
  const staff = useStaff()
  return [staff?.name, staff?.role] as const
}

export function useCustomers() {
  const demo = useIsDemo()
  const who = useLiveKey()
  return useQuery({ queryKey: demo ? customerKeys.all : ['live', 'customers', ...who], queryFn: demo ? customerService.list : liveCustomers })
}

/** Sổ vỏ chỉ có ở bản dùng thử. */
export const useBottleLedger = (customerId: string) => {
  const demo = useIsDemo()
  return useQuery({ queryKey: customerKeys.ledger(customerId), queryFn: () => customerService.ledger(customerId), enabled: demo })
}

/** Địa chỉ giao của khách (tài khoản thật); bản dùng thử lưu địa chỉ ngay trên hồ sơ. */
export const useLiveAddresses = (customerId: string) => {
  const demo = useIsDemo()
  return useQuery({ queryKey: ['live', 'customer-addresses', Number(customerId)], queryFn: () => customerApi.addresses(Number(customerId)), enabled: !demo })
}

/** Đơn thật của một khách, dùng ở hồ sơ khách. */
export const useLiveCustomerOrders = (customerId: string) => {
  const demo = useIsDemo()
  const who = useLiveKey()
  return useQuery({
    queryKey: ['live', 'orders', ...who],
    queryFn: orderApi.list,
    enabled: !demo,
    select: (orders) => orders.filter((order) => order.customerId === Number(customerId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  })
}

const useInvalidateCustomers = () => {
  const queryClient = useQueryClient()
  return () => Promise.all([invalidateLiveData(queryClient), queryClient.invalidateQueries({ queryKey: customerKeys.all })])
}

// Chuỗi rỗng để BE xóa khu vực/ghi chú cũ; null là giữ nguyên.
const toRequest = (draft: CustomerDraft) => ({
  fullName: draft.name.trim(), phone: draft.phone?.replace(/[\s().-]/g, '') || null,
  customerType: draft.type, area: draft.area?.trim() ?? '', note: draft.note?.trim() ?? '',
})

/** Thêm mới khi không có `id`, cập nhật khi có. */
export function useSaveCustomer() {
  const demo = useIsDemo()
  const invalidate = useInvalidateCustomers()
  return useMutation({
    mutationFn: async ({ id, draft }: { id?: string; draft: CustomerDraft }): Promise<Customer> => {
      if (demo) return id ? customerService.update(id, draft) : customerService.create(draft)
      const saved = id ? await api.put<CustomerResponse>(`/sales/customers/${id}`, toRequest(draft)) : await api.post<CustomerResponse>('/sales/customers', toRequest(draft))
      return fromResponse(saved, 0)
    },
    onSuccess: () => void invalidate(),
  })
}

export function useDeactivateCustomer() {
  const demo = useIsDemo()
  const invalidate = useInvalidateCustomers()
  return useMutation({
    mutationFn: (id: string) => (demo ? customerService.deactivate(id) : api.delete<void>(`/sales/customers/${id}`)),
    onSuccess: () => void invalidate(),
  })
}

/** Khách đã lưu trữ; BE chưa có API nên chỉ bản dùng thử (cờ `reactivate`). */
export function useArchivedCustomers(enabled: boolean) {
  return useQuery({ queryKey: [...customerKeys.all, 'archived'], queryFn: customerService.archived, enabled })
}

export function useActivateCustomer() {
  const invalidate = useInvalidateCustomers()
  return useMutation({ mutationFn: customerService.activate, onSuccess: () => void invalidate() })
}

export function useRecordBottles() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ customerId, action }: { customerId: string; action: BottleAction }) => customerService.recordBottles(customerId, action),
    // Khóa ['customers'] bao gồm cả sổ vỏ của từng khách.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customerKeys.all }),
  })
}
