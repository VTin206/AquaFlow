import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supplierService } from './supplierService'
import type { Supplier } from './types'

export const supplierKeys = { all: ['suppliers'] as const }
export const useSuppliers = () => useQuery({ queryKey: supplierKeys.all, queryFn: supplierService.list })

export function useCreateSupplier() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: supplierService.create,
    onSuccess: (supplier) => {
      queryClient.setQueryData<Supplier[]>(supplierKeys.all, (suppliers) => suppliers ? [supplier, ...suppliers] : undefined)
      queryClient.invalidateQueries({ queryKey: supplierKeys.all })
    },
  })
}
