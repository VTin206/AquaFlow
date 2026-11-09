import { describe, expect, it } from 'vitest'
import type { Order } from '@/features/orders/types'
import { demoCollections, toDriverTrip } from './demoDriverData'
import type { Trip } from './types'

const order = (id: string, status: Order['status'], extra: Partial<Order> = {}) =>
  ({
    id,
    customer: `Khách ${id}`,
    phone: '0901 234 567',
    address: '12 Lê Lợi',
    area: 'Bến Nghé',
    items: '',
    total: 100000,
    time: '',
    status,
    method: 'Giao tận nơi',
    channel: 'Website',
    lines: [{ productId: 'P1', name: 'Bình 19L', unit: 'Bình', quantity: 2, unitPrice: 50000 }],
    deliveryFee: 0,
    payments: [],
    history: [],
    stockReserved: true,
    ...extra,
  }) as Order

const trip: Trip = {
  id: 'CH-7',
  driver: 'Lê Minh Quân',
  orderIds: ['AF-1', 'AF-2', 'AF-3'],
  createdAt: '2026-11-09T01:00:00.000Z',
  departedAt: '2026-11-09T02:00:00.000Z',
  status: 'Đang giao',
}

describe('toDriverTrip', () => {
  it('maps the sample trip onto the API shape used by the shared driver screen', () => {
    const result = toDriverTrip(trip, [order('AF-1', 'Đang giao', { floor: 3, note: 'Gọi trước' })])
    expect(result).toMatchObject({ id: 7, driverId: 2, driverName: 'Lê Minh Quân', status: 'IN_PROGRESS' })
    expect(result.orders[0]).toMatchObject({
      orderCode: 'AF-1',
      orderStatus: 'OUT_FOR_DELIVERY',
      recipientPhone: '0901234567',
      deliveryAddress: '12 Lê Lợi, Bến Nghé',
      note: 'Gọi trước · Lầu 3 (thang bộ)',
      latestAttempt: null,
    })
  })

  it('reports a finished stop with its outcome and a settled trip as completed', () => {
    const settlement = { cashExpected: 0, cashHandedOver: 0, bottlesExpected: 0, bottlesHandedOver: 0, settledAt: '2026-11-09T05:00:00.000Z' }
    const failed = order('AF-2', 'Giao thất bại', {
      history: [{ at: '2026-11-09T03:00:00.000Z', message: 'Giao thất bại: Khách vắng nhà' }],
    })
    const result = toDriverTrip({ ...trip, settlement, status: 'Đã đối soát' }, [failed, order('AF-3', 'Đã giao')])
    expect(result.status).toBe('COMPLETED')
    expect(result.orders[0].latestAttempt?.outcome).toBe('FAILED')
    expect(result.orders[1].latestAttempt?.outcome).toBe('SUCCESS')
  })
})

describe('demoCollections', () => {
  it('derives what the driver must collect from the sample orders', () => {
    const paid = order('AF-1', 'Đang giao', { payments: [{ id: 'T1', amount: 40000, method: 'Tiền mặt', recordedAt: '' }] })
    expect(demoCollections(trip, [paid]).balances[0]).toEqual({ orderId: 1, total: 100000, paid: 40000, due: 60000, bottlesToExchange: 2 })
  })
})
