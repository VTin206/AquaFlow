import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { productService } from './productService'
import type { Product } from './types'

export const productKeys = { all: ['products'] as const }

export const useProducts = () => useQuery({ queryKey: productKeys.all, queryFn: productService.list })

export function useCreateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: productService.create,
    onSuccess: (product) => {
      queryClient.setQueryData<Product[]>(productKeys.all, (products) => (products ? [product, ...products] : products))
      queryClient.invalidateQueries({ queryKey: productKeys.all })
    },
  })
}

export function useReceiveStock() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: productService.receiveStock,
    onSuccess: (updated) => {
      queryClient.setQueryData<Product[]>(productKeys.all, (products) => products?.map((product) => (product.id === updated.id ? updated : product)))
      queryClient.invalidateQueries({ queryKey: productKeys.all })
    },
  })
}
