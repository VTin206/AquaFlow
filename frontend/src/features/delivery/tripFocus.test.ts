import { describe, expect, it } from 'vitest'
import type { DeliveryStop } from './deliveryApi'
import { driverTripFocus, liveTripFocus, liveTripStatus } from './tripFocus'

const stop = (orderStatus: string, outcome?: 'SUCCESS' | 'FAILED') =>
  ({ orderStatus, latestAttempt: outcome ? { outcome } : null }) as DeliveryStop
const trip = (status: 'CREATED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED', orders: DeliveryStop[], driverId: number | null = 1) => ({
  status,
  orders,
  driverId,
})

describe('liveTripFocus', () => {
  it('walks through the steps the backend requires, one primary action at a time', () => {
    expect(liveTripFocus(trip('CREATED', [], null)).next).toBe('addOrders')
    expect(liveTripFocus(trip('CREATED', [stop('PREPARING')], null)).next).toBe('assignDriver')
    expect(liveTripFocus(trip('CREATED', [stop('PREPARING'), stop('OUT_FOR_DELIVERY')])).next).toBe('dispatch')
    expect(liveTripFocus(trip('CREATED', [stop('OUT_FOR_DELIVERY')])).next).toBe('depart')
    expect(liveTripFocus(trip('IN_PROGRESS', [stop('DELIVERED', 'SUCCESS')])).next).toBe('settle')
  })

  it('counts only orders still to dispatch', () => {
    expect(liveTripFocus(trip('CREATED', [stop('PREPARING'), stop('OUT_FOR_DELIVERY')])).focus.title).toBe('Cần xuất kho 1 đơn')
  })

  it('explains why settling is not available yet', () => {
    const { focus, next } = liveTripFocus(trip('IN_PROGRESS', [stop('DELIVERED', 'SUCCESS'), stop('OUT_FOR_DELIVERY')]))
    expect(next).toBeUndefined()
    expect(focus.title).toBe('Đã có kết quả 1/2 điểm giao')
    expect(focus.description).toContain('Ghi đủ kết quả')
  })

  it('treats a failed delivery as a result and mentions it', () => {
    const { focus, next } = liveTripFocus(trip('IN_PROGRESS', [stop('OUT_FOR_DELIVERY', 'FAILED')]))
    expect(next).toBe('settle')
    expect(focus.description).toContain('1 đơn giao thất bại')
  })

  it('does not offer departure when an order is no longer eligible', () => {
    const { focus, next } = liveTripFocus(trip('CREATED', [stop('CANCELLED')]))
    expect(next).toBeUndefined()
    expect(focus.tone).toBe('alert')
  })

  it('has nothing left to do on finished trips', () => {
    expect(liveTripFocus(trip('COMPLETED', [stop('DELIVERED', 'SUCCESS')])).next).toBeUndefined()
    expect(liveTripFocus(trip('CANCELLED', [])).focus.tone).toBe('muted')
  })
})

describe('liveTripStatus', () => {
  it('uses the same wording as the demo', () => {
    expect(liveTripStatus(trip('CREATED', []))).toBe('Chờ xuất phát')
    expect(liveTripStatus(trip('IN_PROGRESS', [stop('OUT_FOR_DELIVERY')]))).toBe('Đang giao')
    expect(liveTripStatus(trip('IN_PROGRESS', [stop('DELIVERED', 'SUCCESS')]))).toBe('Chờ đối soát')
    expect(liveTripStatus(trip('COMPLETED', []))).toBe('Đã đối soát')
    expect(liveTripStatus(trip('CANCELLED', []))).toBe('Đã hủy')
  })
})

describe('liveTripFocus on a partly dispatched trip', () => {
  it('asks to dispatch the remaining orders before anything else', () => {
    const { focus, next } = liveTripFocus(trip('IN_PROGRESS', [stop('OUT_FOR_DELIVERY'), stop('PREPARING')]))
    expect(next).toBe('dispatch')
    expect(focus.title).toBe('Cần xuất kho 1 đơn')
  })
})

describe('driverTripFocus', () => {
  const base = { total: 2, pending: 2, waitingDispatch: 0, nextCustomer: 'Lan' }

  it('tells the driver what to do next at each stage', () => {
    expect(driverTripFocus({ ...base, stage: 'preparing', waitingDispatch: 1 }).title).toBe('Chờ cửa hàng xuất kho 1 đơn')
    expect(driverTripFocus({ ...base, stage: 'preparing' }).title).toBe('Nhận đủ hàng rồi bắt đầu chuyến')
    expect(driverTripFocus({ ...base, stage: 'delivering' }).title).toBe('Điểm tiếp theo: Lan')
    expect(driverTripFocus({ ...base, stage: 'delivering', pending: 0 }).title).toBe('Về cửa hàng đối soát')
  })

  it('has nothing to do on finished or empty trips', () => {
    expect(driverTripFocus({ ...base, stage: 'settled' }).tone).toBe('done')
    expect(driverTripFocus({ ...base, stage: 'cancelled' }).tone).toBe('muted')
    expect(driverTripFocus({ ...base, stage: 'preparing', total: 0, pending: 0 }).tone).toBe('waiting')
  })
})
