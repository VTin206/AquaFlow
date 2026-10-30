import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/useAuth'
import { useStaff } from '../auth/useStaff'
import { invalidateLiveData } from '../live/invalidateLiveData'
import { supplierApi, supplierService, type SupplierStatus } from './supplierService'
import type { SupplierDraft } from './types'

export const supplierKeys = { all: ['suppliers'] as const }

const useDemo = () => useAuth().user?.isDemo ?? false

/** Bản dùng thử: quản lý và bán hàng được sửa; tài khoản thật: theo BE, chỉ ADMIN. */
export function useCanManageSuppliers() {
  const demo = useDemo()
  const role = useStaff()?.role
  return demo ? role === 'ADMIN' || role === 'SALES_STAFF' : role === 'ADMIN'
}

export function useSuppliers(status: SupplierStatus = 'active') {
  const demo = useDemo()
  const staff = useStaff()
  return useQuery({
    queryKey: demo ? [...supplierKeys.all, status] : ['live', 'suppliers', staff?.name, staff?.role, status],
    queryFn: async () => demo
      ? (await supplierService.list()).filter((supplier) => status === 'all' || supplier.active === (status === 'active'))
      : supplierApi.list(status),
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

/** BE chưa có API bật lại nên chỉ bản dùng thử (cờ `reactivate`). */
export function useActivateSupplier() {
  const invalidate = useInvalidateSuppliers()
  return useMutation({ mutationFn: supplierService.activate, onSuccess: () => void invalidate() })
}

export function useDeactivateSupplier() {
  const demo = useDemo()
  const invalidate = useInvalidateSuppliers()
  return useMutation({
    mutationFn: (id: string) => (demo ? supplierService : supplierApi).deactivate(id),
    onSuccess: () => void invalidate(),
  })
}
