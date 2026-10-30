import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { productKeys } from '../inventory/useProducts'
import { orderKeys } from '../orders/useOrders'
import { tripService } from './tripService'
import type { SettlementDraft, TripDraft } from './types'

export const tripKeys = { all: ['trips'] as const }

export const useTrips = () => useQuery({ queryKey: tripKeys.all, queryFn: tripService.list })

type TripAction =
  | { kind: 'create'; draft: TripDraft }
  | { kind: 'dispatch'; id: string; orderId?: string }
  | { kind: 'addOrders'; id: string; orderIds: string[] }
  | { kind: 'removeOrder'; id: string; orderId: string }
  | { kind: 'cancel'; id: string }
  | { kind: 'settle'; id: string; draft: SettlementDraft }

export function useTripAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (action: TripAction) => {
      if (action.kind === 'create') return tripService.create(action.draft)
      if (action.kind === 'dispatch') return tripService.dispatch(action.id, action.orderId)
      if (action.kind === 'addOrders') return tripService.addOrders(action.id, action.orderIds)
      if (action.kind === 'removeOrder') return tripService.removeOrder(action.id, action.orderId)
      if (action.kind === 'cancel') return tripService.cancel(action.id)
      return tripService.settle(action.id, action.draft)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tripKeys.all })
      queryClient.invalidateQueries({ queryKey: orderKeys.all })
      // Xuất kho làm đổi tồn và lô.
      queryClient.invalidateQueries({ queryKey: productKeys.all })
    },
  })
}
