import { expect, test } from 'vitest'
import type { Vehicle } from './deliveryApi'
import { driverLabel, suggestVehicle, vehicleBlocker, vehicleLabel } from './vehiclePlan'

const vehicle = (id: number, capacity: number, extra: Partial<Vehicle> = {}): Vehicle => ({
  id,
  plate: `XE-${id}`,
  name: null,
  capacity,
  active: true,
  busyTripId: null,
  ...extra,
})

test('gợi ý xe nhỏ nhất còn rảnh mà chở đủ số kiện', () => {
  const fleet = [vehicle(1, 60), vehicle(2, 20), vehicle(3, 10), vehicle(4, 15, { busyTripId: 7 }), vehicle(5, 12, { active: false })]
  expect(suggestVehicle(fleet, 12)?.id).toBe(2)
  expect(suggestVehicle(fleet, 8)?.id).toBe(3)
  expect(suggestVehicle(fleet, 61)).toBeUndefined()
})

test('ghi rõ vì sao không chọn được xe', () => {
  expect(vehicleBlocker(vehicle(1, 10, { busyTripId: 3 }), 5)).toBe('đang ở chuyến #3')
  expect(vehicleBlocker(vehicle(1, 10), 14)).toBe('thiếu 4 kiện')
  expect(vehicleBlocker(vehicle(1, 10), 10)).toBeUndefined()
  expect(vehicleLabel(vehicle(1, 10, { name: 'Ba gác' }), 14)).toBe('XE-1 · 10 kiện · Ba gác · thiếu 4 kiện')
  expect(driverLabel({ id: 1, name: 'An', busyTripId: 9 })).toBe('An · đang ở chuyến #9')
  expect(driverLabel({ id: 2, name: 'Bình', busyTripId: null })).toBe('Bình')
})
