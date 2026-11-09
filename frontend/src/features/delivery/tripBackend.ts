import type { QueryClient } from '@tanstack/react-query'
import { invalidateLiveData } from '@/features/live/invalidateLiveData'
import { canDispatch, orderService } from '@/features/orders/orderService'
import { useOrders } from '@/features/orders/useOrders'
import { useIsDemo } from '@/shared/features'
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
import { demoAttempts, demoCollections, demoDrivers, numericId, toDriverTrip } from './demoDriverData'
import { openIn, tripService } from './tripService'
import { useTrips } from './useTrips'
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
  /** Không có nghĩa là dữ liệu mẫu chưa hỗ trợ thao tác này. */
  assignDriver?: (trip: DeliveryTrip, driverId: number) => Promise<unknown>
  recordResult?: (stop: DeliveryStop, input: ResultInput) => Promise<unknown>
  refresh: (client: QueryClient) => Promise<unknown>
}

/** Nguồn dữ liệu và thao tác của màn hình chuyến giao; giao diện không cần biết đang là bản dùng thử hay tài khoản thật. */
export type TripBackend = {
  demo: boolean
  useTrips: () => Q<DeliveryTrip[]>
  useDetail: (id: number) => Q<DeliveryTrip>
  useCollections: (id: number) => Q<TripCollections>
  useDrivers: (enabled?: boolean) => Q<Driver[]>
  useAvailable: () => Q<AvailableOrder[]>
  ops: TripOps
}

const liveTripBackend: TripBackend = {
  demo: false,
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

function useDemoData() {
  const tripsQuery = useTrips()
  const ordersQuery = useOrders()
  const records = tripsQuery.data ?? []
  const orders = ordersQuery.data ?? []
  const stopsOf = (ids: string[]) => ids.map((id) => orders.find((order) => order.id === id)).filter((order) => order !== undefined)
  const trips = records.map((trip, index) => toDriverTrip(trip, stopsOf(trip.orderIds), index))
  return { tripsQuery, ordersQuery, records, orders, stopsOf, trips, pending: tripsQuery.isPending || ordersQuery.isPending }
}

const tripRef = (trip: DeliveryTrip) => trip.tripRef ?? String(trip.id)
/** Mã đơn trong danh sách đơn: dữ liệu mẫu dùng mã chữ, API dùng số. */
export const stopOrderId = (stop: Pick<DeliveryStop, 'orderId' | 'orderRef'>) => stop.orderRef ?? String(stop.orderId)

const demoTripBackend: TripBackend = {
  demo: true,
  useTrips: () => {
    const { tripsQuery, ordersQuery, trips, pending } = useDemoData()
    const error = tripsQuery.error ?? ordersQuery.error
    return {
      data: tripsQuery.data && ordersQuery.data ? trips : undefined,
      isPending: pending,
      isError: Boolean(error),
      error,
      refetch: () => Promise.all([tripsQuery.refetch(), ordersQuery.refetch()]),
    }
  },
  useDetail: (id) => {
    const { tripsQuery, trips, pending } = useDemoData()
    const data = trips.find((trip) => trip.id === id)
    const missing = !pending && !data
    return {
      data,
      isPending: pending,
      isError: missing,
      error: missing ? new Error('Chuyến không còn tồn tại.') : null,
      refetch: tripsQuery.refetch,
    }
  },
  useCollections: (id) => {
    const { tripsQuery, records, trips, stopsOf, pending } = useDemoData()
    const index = trips.findIndex((trip) => trip.id === id)
    return {
      data: index < 0 ? undefined : demoCollections(records[index], stopsOf(records[index].orderIds)),
      isPending: pending,
      isError: false,
      error: null,
      refetch: tripsQuery.refetch,
    }
  },
  useDrivers: () => ({ data: demoDrivers, isPending: false, isError: false, error: null, refetch: () => undefined }),
  useAvailable: () => {
    const { ordersQuery, records, orders, pending } = useDemoData()
    // Đơn còn việc ở một chuyến chưa đối soát thì không xếp thêm; đơn giao lại (đã kiểm hàng hoàn) quay về danh sách chờ.
    const busy = new Set(
      records
        .filter((trip) => !trip.settlement)
        .flatMap((trip) =>
          trip.orderIds.filter((id) => {
            const order = orders.find((item) => item.id === id)
            return !order || openIn(trip, order)
          }),
        ),
    )
    return {
      data: orders
        .filter((order) => canDispatch(order) && !busy.has(order.id))
        .map((order, index) => ({
          id: numericId(order.id, index + 1),
          orderRef: order.id,
          orderCode: order.code ?? order.id,
          recipientName: order.customer,
          deliveryAddress: [order.address, order.area].filter(Boolean).join(', ') || null,
          deliveryFailed: order.status === 'Giao thất bại',
          redeliveryEligible: Boolean(order.dispatches?.length),
        })),
      isPending: pending,
      isError: ordersQuery.isError,
      error: ordersQuery.error,
      refetch: ordersQuery.refetch,
    }
  },
  ops: {
    create: async (values, orders) => {
      const driver = demoDrivers.find((item) => item.id === values.driverId)?.name ?? ''
      const trip = await tripService.create({ driver, vehicle: values.vehicle, orderIds: orders.map((order) => order.id) })
      return { tripId: numericId(trip.id, 0), failed: [] }
    },
    dispatchAll: (trip) => tripService.dispatch(tripRef(trip)),
    dispatchStop: (trip, stop) => tripService.dispatch(tripRef(trip), stopOrderId(stop)),
    // Dữ liệu mẫu chuyển sang đang giao ngay khi xuất kho nên không có bước khởi hành riêng.
    depart: () => Promise.resolve(),
    cancel: (trip) => tripService.cancel(tripRef(trip)),
    removeStop: (trip, stop) => tripService.removeOrder(tripRef(trip), stopOrderId(stop)),
    addOrder: (trip, order) => tripService.addOrders(tripRef(trip), [order.orderRef ?? String(order.id)]),
    settle: (trip, input) =>
      tripService.settle(tripRef(trip), {
        cashHandedOver: Math.round(input.cashConfirmed),
        bottlesHandedOver: input.bottlesConfirmed,
        note: input.note,
      }),
    attempts: async (stop) => {
      const order = (await orderService.list()).find((item) => item.id === stopOrderId(stop))
      return order ? demoAttempts(order) : []
    },
    refresh: (client) => client.invalidateQueries(),
  },
}

export const useTripBackend = () => (useIsDemo() ? demoTripBackend : liveTripBackend)
