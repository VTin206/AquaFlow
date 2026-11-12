import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useStaff } from '@/features/auth/useStaff'
import { invalidateLiveData } from '@/features/live/invalidateLiveData'
import { supplierApi, type SupplierStatus } from './supplierService'
import type { SupplierDraft } from './types'
import { sortByName } from '@/shared/utils/table'

export const supplierKeys = { all: ['suppliers'] as const }

/** Store staff manage the catalog. */
export function useCanManageSuppliers() {
  const role = useStaff()?.role
  return role === 'ADMIN' || role === 'SALES_STAFF'
}

export function useSuppliers(status: SupplierStatus = 'active') {
  const staff = useStaff()
  return useQuery({
    queryKey: ['live', 'suppliers', staff?.name, staff?.role, status],
    queryFn: () => supplierApi.list(status),
    select: sortByName,
  })
}

const useInvalidateSuppliers = () => {
  const queryClient = useQueryClient()
  return () => Promise.all([invalidateLiveData(queryClient), queryClient.invalidateQueries({ queryKey: supplierKeys.all })])
}

export function useSaveSupplier() {
  const invalidate = useInvalidateSuppliers()
  return useMutation({
    mutationFn: ({ id, draft }: { id?: string; draft: SupplierDraft }) => {
      return id === undefined ? supplierApi.create(draft) : supplierApi.update(id, draft)
    },
    onSuccess: () => void invalidate(),
  })
}

export function useActivateSupplier() {
  const invalidate = useInvalidateSuppliers()
  return useMutation({
    mutationFn: async (id: string) => {
      await supplierApi.activate(id)
    },
    onSuccess: () => void invalidate(),
  })
}

export function useDeactivateSupplier() {
  const invalidate = useInvalidateSuppliers()
  return useMutation({
    mutationFn: (id: string) => supplierApi.deactivate(id),
    onSuccess: () => void invalidate(),
  })
}
