import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/useAuth'
import { useStaff } from '@/features/auth/useStaff'
import { invalidateLiveData } from '@/features/live/invalidateLiveData'
import { supplierApi, supplierService, type SupplierStatus } from './supplierService'
import type { SupplierDraft } from './types'
import { sortByName } from '@/shared/utils/table'

export const supplierKeys = { all: ['suppliers'] as const }

const useDemo = () => useAuth().user?.isDemo ?? false

/** Store staff manage the catalog in both demo and live mode. */
export function useCanManageSuppliers() {
  const role = useStaff()?.role
  return role === 'ADMIN' || role === 'SALES_STAFF'
}

export function useSuppliers(status: SupplierStatus = 'active') {
  const demo = useDemo()
  const staff = useStaff()
  return useQuery({
    queryKey: demo ? [...supplierKeys.all, status] : ['live', 'suppliers', staff?.name, staff?.role, status],
    queryFn: async () =>
      demo
        ? (await supplierService.list()).filter((supplier) => status === 'all' || supplier.active === (status === 'active'))
        : supplierApi.list(status),
    select: sortByName,
  })
}

const useInvalidateSuppliers = () => {
  const queryClient = useQueryClient()
  return () => Promise.all([invalidateLiveData(queryClient), queryClient.invalidateQueries({ queryKey: supplierKeys.all })])
}

export function useSaveSupplier() {
  const demo = useDemo()
  const invalidate = useInvalidateSuppliers()
  return useMutation({
    mutationFn: ({ id, draft }: { id?: string; draft: SupplierDraft }) => {
      const service = demo ? supplierService : supplierApi
      return id === undefined ? service.create(draft) : service.update(id, draft)
    },
    onSuccess: () => void invalidate(),
  })
}

export function useActivateSupplier() {
  const demo = useDemo()
  const invalidate = useInvalidateSuppliers()
  return useMutation({
    mutationFn: async (id: string) => {
      await (demo ? supplierService : supplierApi).activate(id)
    },
    onSuccess: () => void invalidate(),
  })
}

export function useDeactivateSupplier() {
  const demo = useDemo()
  const invalidate = useInvalidateSuppliers()
  return useMutation({
    mutationFn: (id: string) => (demo ? supplierService : supplierApi).deactivate(id),
    onSuccess: () => void invalidate(),
  })
}
