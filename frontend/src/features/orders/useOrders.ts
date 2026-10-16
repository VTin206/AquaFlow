import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { customerKeys } from '../customers/useCustomers'
import { productKeys } from '../inventory/useProducts'
import { orderService } from './orderService'
import type { DeliveryResult, Order, PaymentDraft, RefundDraft, ReturnDraft } from './types'

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
      queryClient.invalidateQueries({ queryKey: customerKeys.all })
      // Kết quả giao từng đơn làm đổi trạng thái chuyến giao.
      queryClient.invalidateQueries({ queryKey: ['trips'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['activity'] })
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
      queryClient.invalidateQueries({ queryKey: productKeys.all })
      queryClient.invalidateQueries({ queryKey: customerKeys.all })
      // Kết quả giao từng đơn làm đổi trạng thái chuyến giao.
      queryClient.invalidateQueries({ queryKey: ['trips'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['activity'] })
    },
  })
}

type OrderAction =
  | { kind: 'receive'; id: string; result: DeliveryResult }
  | { kind: 'pay'; id: string; payment: PaymentDraft }
  | { kind: 'cancel'; id: string; reason: string; refund?: RefundDraft }
  | { kind: 'return'; id: string; draft: ReturnDraft }

export function useOrderAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (action: OrderAction) => {
      if (action.kind === 'receive') return orderService.receive(action.id, action.result)
      if (action.kind === 'pay') return orderService.pay(action.id, action.payment)
      if (action.kind === 'return') return orderService.returnItems(action.id, action.draft)
      return orderService.cancel(action.id, action.reason, action.refund)
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<Order[]>(orderKeys.all, (orders) => orders?.map((order) => (order.id === updated.id ? updated : order)))
      queryClient.invalidateQueries({ queryKey: orderKeys.all })
      queryClient.invalidateQueries({ queryKey: productKeys.all })
      queryClient.invalidateQueries({ queryKey: customerKeys.all })
      // Kết quả giao từng đơn làm đổi trạng thái chuyến giao.
      queryClient.invalidateQueries({ queryKey: ['trips'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['activity'] })
    },
  })
}
