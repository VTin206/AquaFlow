import { deliveryApi } from '@/features/delivery/deliveryApi'

/** Existing Delivery API scopes trips to staff. Never called from the customer workspace. */
export async function orderDeliveryHistory(orderId: number) {
  // BE lọc theo đơn; vẫn lọc lại phòng khi API cũ chưa hỗ trợ tham số này.
  const trips = (await deliveryApi.list({ orderId })).filter((trip) => trip.orders.some((order) => order.orderId === orderId))
  return Promise.all(
    trips
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id)
      .map(async (trip) => ({
        trip,
        assignment: trip.orders.find((order) => order.orderId === orderId)!,
        attempts: (await deliveryApi.attempts(trip.id, orderId)).sort((a, b) => a.attemptNo - b.attemptNo),
      })),
  )
}
