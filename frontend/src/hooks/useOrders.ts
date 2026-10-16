import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { orderService } from '../services/orders'
import type { Order } from '../types'
import { productKeys } from './useProducts'

export const orderKeys = { all: ['orders'] as const }

export const useOrders = () => useQuery({ queryKey: orderKeys.all, queryFn: orderService.list })

export function useCreateOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: orderService.create,
    onSuccess: (order) => {
      // Hiện đơn mới ngay, sau đó đồng bộ lại với server.
      queryClient.setQueryData<Order[]>(orderKeys.all, (orders) => (orders ? [order, ...orders] : orders))
      queryClient.invalidateQueries({ queryKey: orderKeys.all })
      queryClient.invalidateQueries({ queryKey: productKeys.all })
    },
  })
}

export function useAdvanceOrderStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: orderService.advanceStatus,
    onSuccess: (updated) => {
      queryClient.setQueryData<Order[]>(orderKeys.all, (orders) => orders?.map((order) => (order.id === updated.id ? updated : order)))
      queryClient.invalidateQueries({ queryKey: orderKeys.all })
    },
  })
}
