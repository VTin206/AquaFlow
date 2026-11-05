import type { LiveOrder } from '@/features/live/orderApi'

export function progressSteps(order: Pick<LiveOrder, 'status' | 'fulfillmentType'>) {
  const states = [
    'PENDING',
    'CONFIRMED',
    'PREPARING',
    ...(order.fulfillmentType === 'DELIVERY' ? ['OUT_FOR_DELIVERY'] : []),
    'DELIVERED',
  ] as LiveOrder['status'][]
  return { states, current: order.status === 'COMPLETED' ? states.length - 1 : states.indexOf(order.status) }
}
