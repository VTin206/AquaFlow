import { useQuery } from '@tanstack/react-query'
import { api } from '@/shared/api/client'
import { useStaff } from '@/features/auth/useStaff'

export type OrderBalance = { orderId: number; orderCode: string; customerId: number | null; status: string; total: number; received: number; refunded: number; paid: number; due: number; refundDue: number }
export type PaymentReceipt = { id: number; orderId: number; amount: number; direction: 'IN' | 'OUT'; method: 'CASH' | 'BANK_TRANSFER'; reference: string | null; note: string | null; recordedBy: number; recordedByName: string; createdAt: string; source: 'SALES' | 'DELIVERY' }
export type PaymentInput = { requestId: string; amount: number; direction: 'IN' | 'OUT'; method: 'CASH' | 'BANK_TRANSFER'; reference?: string; note?: string }
export type CustomerBalance = { customerId: number; name: string; active: boolean; due: number; refundDue: number }
export const paymentApi = {
  list: (id: number) => api.get<{ balance: OrderBalance; payments: PaymentReceipt[] }>(`/sales/orders/${id}/payments`),
  create: (id: number, input: PaymentInput) => api.post<PaymentReceipt>(`/sales/orders/${id}/payments`, input),
  balances: () => api.get<OrderBalance[]>('/sales/order-balances'),
  customers: () => api.get<CustomerBalance[]>('/sales/customer-balances'),
  receivables: (id: number) => api.get<OrderBalance[]>(`/sales/customers/${id}/receivables`),
}
export function useOrderPayments(id: number) {
  const staff = useStaff()
  return useQuery({ queryKey: ['live', 'payments', staff?.name, staff?.role, id], queryFn: () => paymentApi.list(id), enabled: staff?.role === 'ADMIN' || staff?.role === 'SALES_STAFF', refetchInterval: 15000 })
}
