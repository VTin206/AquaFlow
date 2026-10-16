import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { customerService } from './customerService'
import type { BottleAction, CustomerDraft } from './types'

export const customerKeys = {
  all: ['customers'] as const,
  ledger: (customerId: string) => ['customers', customerId, 'ledger'] as const,
}

export const useCustomers = () => useQuery({ queryKey: customerKeys.all, queryFn: customerService.list })

export const useBottleLedger = (customerId: string) =>
  useQuery({ queryKey: customerKeys.ledger(customerId), queryFn: () => customerService.ledger(customerId) })

/** Thêm mới khi không có `id`, cập nhật khi có. */
export function useSaveCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, draft }: { id?: string; draft: CustomerDraft }) => (id ? customerService.update(id, draft) : customerService.create(draft)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customerKeys.all }),
  })
}

export function useRecordBottles() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ customerId, action }: { customerId: string; action: BottleAction }) => customerService.recordBottles(customerId, action),
    // Khóa ['customers'] bao gồm cả sổ vỏ của từng khách.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customerKeys.all }),
  })
}
