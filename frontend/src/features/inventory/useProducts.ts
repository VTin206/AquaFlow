import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { productService } from './productService'
import type { Product } from './types'

export const productKeys = {
  all: ['products'] as const,
  lots: ['products', 'lots'] as const,
  receipts: ['products', 'receipts'] as const,
}

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

export const useLots = () => useQuery({ queryKey: productKeys.lots, queryFn: productService.lots })
export const useReceipts = () => useQuery({ queryKey: productKeys.receipts, queryFn: productService.receipts })

export function useCreateReceipt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: productService.createReceipt,
    // Khóa ['products'] bao gồm cả lô và phiếu nhập.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productKeys.all }),
  })
}
