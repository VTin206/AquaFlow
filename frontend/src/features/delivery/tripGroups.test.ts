import { describe, expect, it } from 'vitest'
import type { DeliveryTrip } from './deliveryApi'
import { inTripRange, tripGroupOf } from './tripGroups'

const trip = (status: DeliveryTrip['status'], endedAt: string | null): DeliveryTrip => ({
  id: 1,
  driverId: 1,
  driverName: 'Tài xế',
  vehicle: null,
  status,
  createdAt: '2026-10-01T08:00:00',
  startedAt: '2026-10-01T09:00:00',
  endedAt,
  createdBy: 1,
  orders: [],
  settlement: null,
})

describe('trip groups', () => {
  it('puts settling first, running trips together and finished trips last', () => {
    expect(tripGroupOf('Chờ đối soát')).toBe('settle')
    expect(tripGroupOf('Chờ xuất phát')).toBe('running')
    expect(tripGroupOf('Đang giao')).toBe('running')
    expect(tripGroupOf('Đã đối soát')).toBe('done')
    expect(tripGroupOf('Đã hủy')).toBe('done')
  })

  it('filters only finished trips by their last activity date', () => {
    const now = new Date('2026-11-15T12:00:00')
    expect(inTripRange(trip('COMPLETED', '2026-11-15T08:00:00'), 'today', now)).toBe(true)
    expect(inTripRange(trip('COMPLETED', '2026-11-14T20:00:00'), 'today', now)).toBe(false)
    expect(inTripRange(trip('COMPLETED', '2026-11-09T08:00:00'), '7', now)).toBe(true)
    expect(inTripRange(trip('COMPLETED', '2026-11-01T08:00:00'), '7', now)).toBe(false)
    // Chuyến chưa xong luôn hiện dù tạo từ lâu.
    expect(inTripRange(trip('CREATED', null), 'today', now)).toBe(true)
  })
})
