import { useQuery } from '@tanstack/react-query'
import { api } from '@/shared/api/client'

export type ReturnLine = { loadItemId: number; batchId: number; productName: string; lotCode: string; expiresOn: string; quantity: number; sellable: number | null }
export type PendingReturn = { orderId: number; orderCode: string; recipientName: string; assignmentId: number; failureReason: string; lines: ReturnLine[] }
export type ReturnInspection = { id: number; orderId: number; orderCode: string; assignmentId: number; performedBy: number; createdAt: string; note: string | null; lines: ReturnLine[] }
export type ReturnInput = { orderId: number; lines: { loadItemId: number; sellable: number }[]; note?: string }
export const returnApi = {
  pending: () => api.get<PendingReturn[]>('/inventory/returns/pending'),
  list: (page: number) => api.get<ReturnInspection[]>(`/inventory/returns?page=${page}&size=20`),
  detail: (id: number) => api.get<ReturnInspection>(`/inventory/returns/${id}`),
  create: (input: ReturnInput) => api.post<ReturnInspection>('/inventory/returns', input),
}
export const usePendingReturns = (enabled = true) => useQuery({ queryKey: ['live', 'returns', 'pending'], queryFn: returnApi.pending, enabled, refetchInterval: 15000 })
