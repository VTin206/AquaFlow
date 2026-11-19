import type { DeliveryDriver, Vehicle } from './deliveryApi'

/**
 * Xếp chuyến theo cỡ hàng: chọn xe trước (đủ sức chở, đang rảnh), rồi mới chọn tài xế rảnh.
 * Sức chở tính theo kiện: mỗi bình, thùng hay chai trên đơn là một kiện (giống backend).
 */

/** Xe nhỏ nhất còn rảnh mà chở đủ số kiện; không có thì undefined. */
export function suggestVehicle(vehicles: Vehicle[], units: number) {
  return vehicles
    .filter((vehicle) => vehicle.active && vehicle.busyTripId == null && vehicle.capacity >= units)
    .sort((a, b) => a.capacity - b.capacity || a.plate.localeCompare(b.plate))[0]
}

/** Lý do không chọn được xe cho chuyến này, hoặc undefined nếu chọn được. */
export function vehicleBlocker(vehicle: Vehicle, units: number) {
  if (vehicle.busyTripId != null) return `đang ở chuyến #${vehicle.busyTripId}`
  if (vehicle.capacity < units) return `thiếu ${units - vehicle.capacity} kiện`
  return undefined
}

export function vehicleLabel(vehicle: Vehicle, units: number) {
  const blocker = vehicleBlocker(vehicle, units)
  return [vehicle.plate, `${vehicle.capacity} kiện`, vehicle.name, blocker].filter(Boolean).join(' · ')
}

export function driverLabel(driver: DeliveryDriver) {
  return driver.busyTripId != null ? `${driver.name} · đang ở chuyến #${driver.busyTripId}` : driver.name
}
