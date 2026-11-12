import type { QueryClient } from '@tanstack/react-query'
import { invalidateLiveData } from '@/features/live/invalidateLiveData'
import { runEach } from '@/shared/utils/bulk'
import type { WaitingOrder } from './components/WaitingOrdersCard'
import {
  deliveryApi,
  type AvailableOrder,
  type DeliveryAttempt,
  type DeliveryStop,
  type DeliveryTrip,
  type ResultInput,
  type SettlementInput,
  type TripCollections,
} from './deliveryApi'
import { useAvailableOrders, useDeliveryDrivers, useLiveTrip, useLiveTrips, useTripCollections } from './useLiveTrips'

type Q<T> = { data?: T; isPending: boolean; isError: boolean; error: Error | null; refetch: () => unknown }
type Driver = { id: number; name: string }
export type CreateResult = { tripId: number; failed: { item: WaitingOrder; error: string }[] }

export type TripOps = {
  create: (values: { driverId?: number; vehicle?: string }, orders: WaitingOrder[]) => Promise<CreateResult>
  dispatchAll: (trip: DeliveryTrip) => Promise<unknown>
  dispatchStop: (trip: DeliveryTrip, stop: DeliveryStop) => Promise<unknown>
  depart: (trip: DeliveryTrip) => Promise<unknown>
  cancel: (trip: DeliveryTrip) => Promise<unknown>
  removeStop: (trip: DeliveryTrip, stop: DeliveryStop) => Promise<unknown>
  addOrder: (trip: DeliveryTrip, order: AvailableOrder) => Promise<unknown>
  settle: (trip: DeliveryTrip, input: SettlementInput) => Promise<unknown>
  attempts: (stop: DeliveryStop) => Promise<DeliveryAttempt[]>
  assignDriver: (trip: DeliveryTrip, driverId: number) => Promise<unknown>
  recordResult: (stop: DeliveryStop, input: ResultInput) => Promise<unknown>
  refresh: (client: QueryClient) => Promise<unknown>
}

/** Nguồn dữ liệu và thao tác của màn hình chuyến giao. */
export type TripBackend = {
  useTrips: () => Q<DeliveryTrip[]>
  useDetail: (id: number) => Q<DeliveryTrip>
  useCollections: (id: number) => Q<TripCollections>
  useDrivers: (enabled?: boolean) => Q<Driver[]>
  useAvailable: () => Q<AvailableOrder[]>
  ops: TripOps
}

const liveTripBackend: TripBackend = {
  useTrips: useLiveTrips,
  useDetail: useLiveTrip,
  useCollections: useTripCollections,
  useDrivers: useDeliveryDrivers,
  useAvailable: useAvailableOrders,
  ops: {
    create: async (values, orders) => {
      const trip = await deliveryApi.create({ driverId: values.driverId, vehicle: values.vehicle?.trim() || undefined })
      const result = await runEach(orders, (order) => deliveryApi.add(trip.id, Number(order.id), order.redelivery))
      return { tripId: trip.id, failed: result.failed }
    },
    dispatchAll: (trip) => deliveryApi.dispatch(trip.id),
    dispatchStop: (_, stop) => deliveryApi.dispatchAssignment(stop.id),
    depart: (trip) => deliveryApi.depart(trip.id),
    cancel: (trip) => deliveryApi.cancel(trip.id),
    removeStop: (trip, stop) => deliveryApi.remove(trip.id, stop.orderId),
    addOrder: (trip, order) => deliveryApi.add(trip.id, order.id, order.redeliveryEligible),
    settle: (trip, input) => deliveryApi.settle(trip.id, input),
    attempts: (stop) => deliveryApi.assignmentAttempts(stop.id),
    assignDriver: (trip, driverId) => deliveryApi.assign(trip.id, driverId),
    recordResult: (stop, input) => deliveryApi.assignmentResult(stop.id, input),
    refresh: invalidateLiveData,
  },
}

/** Số đơn của một điểm giao, dùng để tìm đơn trong danh sách đơn. */
export const stopOrderId = (stop: Pick<DeliveryStop, 'orderId'>) => String(stop.orderId)

export const useTripBackend = () => liveTripBackend
