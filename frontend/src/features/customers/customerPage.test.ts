import { describe, expect, it } from 'vitest'
import { fromSummary } from './useCustomers'

describe('fromSummary', () => {
  it('maps backend statistics onto the customer used by the screens', () => {
    const mapped = fromSummary({
      id: 7,
      fullName: 'Nguyễn Văn Đức',
      phone: '0901234567',
      createdAt: '2026-01-01T00:00:00Z',
      customerType: 'Doanh nghiệp',
      area: null,
      note: null,
      orderCount: 3,
      lastOrderAt: '2026-11-10T08:00:00+07:00',
      lastDeliveryAddress: '99 Lê Lợi',
      due: 50000,
      bottlesHeld: 2,
      depositHeld: 100000,
    })
    expect(mapped).toMatchObject({
      id: '7',
      name: 'Nguyễn Văn Đức',
      type: 'Doanh nghiệp',
      orders: 3,
      lastOrderAt: '2026-11-10T08:00:00+07:00',
      mainAddress: '99 Lê Lợi',
      debt: 50000,
      bottlesHeld: 2,
      depositHeld: 100000,
    })
  })
})
