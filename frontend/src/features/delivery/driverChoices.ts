import type { DeliveryTrip } from './deliveryApi'

/**
 * Lựa chọn tài xế khi giao một đơn từ màn chi tiết đơn:
 * - tài xế đang có chuyến chờ xuất phát: thêm đơn vào chuyến đó;
 * - tài xế đang giao dở: khóa, ghi rõ chuyến;
 * - tài xế rảnh: tạo chuyến mới cho tài xế đó.
 */
export type DriverChoice = {
  value: string
  label: string
  disabled: boolean
  driverId: number
  driverName: string
  /** Có thì thêm đơn vào chuyến này; không có thì tạo chuyến mới. */
  tripId?: number
}

const stillDelivering = (trip: DeliveryTrip) => trip.status === 'IN_PROGRESS' && trip.orders.some((stop) => !stop.latestAttempt)

export function driverChoices(drivers: { id: number; name: string }[], trips: DeliveryTrip[]): DriverChoice[] {
  return drivers.map((driver) => {
    const own = trips.filter((trip) => trip.driverId === driver.id)
    const running = own.find(stillDelivering)
    if (running)
      return {
        value: `busy:${driver.id}`,
        label: `${driver.name} · đang giao chuyến #${running.id}`,
        disabled: true,
        driverId: driver.id,
        driverName: driver.name,
      }
    const waiting = own.filter((trip) => trip.status === 'CREATED').sort((a, b) => a.id - b.id)[0]
    if (waiting)
      return {
        value: `trip:${waiting.id}`,
        label: `${driver.name} · thêm vào chuyến #${waiting.id} (${waiting.orders.length} đơn, chờ xuất phát)`,
        disabled: false,
        driverId: driver.id,
        driverName: driver.name,
        tripId: waiting.id,
      }
    return {
      value: `new:${driver.id}`,
      label: `${driver.name} · tạo chuyến mới`,
      disabled: false,
      driverId: driver.id,
      driverName: driver.name,
    }
  })
}

/** Chuyến đang chở đơn này (chưa xong), nếu có. */
export const activeTripOf = (orderId: number, trips: DeliveryTrip[]) =>
  trips.find((trip) => (trip.status === 'CREATED' || trip.status === 'IN_PROGRESS') && trip.orders.some((stop) => stop.orderId === orderId))
