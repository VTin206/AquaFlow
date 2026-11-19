import { expect, test } from 'vitest'
import type { DeliveryStop, DeliveryTrip } from './deliveryApi'
import { activeTripOf, driverChoices } from './driverChoices'

const stop = (orderId: number, done = false) =>
  ({ orderId, latestAttempt: done ? { outcome: 'SUCCESS' } : null }) as unknown as DeliveryStop
const trip = (id: number, driverId: number, status: DeliveryTrip['status'], orders: DeliveryStop[]) =>
  ({ id, driverId, status, orders }) as unknown as DeliveryTrip

const drivers = [
  { id: 1, name: 'An' },
  { id: 2, name: 'Bình' },
  { id: 3, name: 'Cường' },
  { id: 4, name: 'Dũng' },
]
const trips = [
  trip(10, 1, 'IN_PROGRESS', [stop(100), stop(101, true)]),
  trip(11, 2, 'CREATED', [stop(102), stop(103)]),
  // Dũng đã giao xong hết, chỉ còn chờ đối soát: coi như rảnh.
  trip(12, 4, 'IN_PROGRESS', [stop(104, true)]),
]

test('tài xế đang giao dở bị khóa, có chuyến chờ thì thêm vào, rảnh thì tạo chuyến mới', () => {
  const [an, binh, cuong, dung] = driverChoices(drivers, trips)
  expect(an).toMatchObject({ disabled: true, label: 'An · đang giao chuyến #10' })
  expect(binh).toMatchObject({ disabled: false, tripId: 11, label: 'Bình · thêm vào chuyến #11 (2 đơn, chờ xuất phát)' })
  expect(cuong).toMatchObject({ disabled: false, label: 'Cường · tạo chuyến mới' })
  expect(cuong.tripId).toBeUndefined()
  expect(dung).toMatchObject({ disabled: false, label: 'Dũng · tạo chuyến mới' })
})

test('đơn đang ở chuyến chưa xong thì không giao thêm lần nữa', () => {
  expect(activeTripOf(102, trips)?.id).toBe(11)
  expect(activeTripOf(999, trips)).toBeUndefined()
  expect(activeTripOf(102, [trip(11, 2, 'CANCELLED', [stop(102)])])).toBeUndefined()
})
