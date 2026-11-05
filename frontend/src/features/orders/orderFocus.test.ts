import { describe, expect, it } from 'vitest'
import { demoOrderFocus, liveOrderFocus } from './orderFocus'
import type { Order } from './types'

const live = (status: Parameters<typeof liveOrderFocus>[0]['status'], fulfillmentType: 'DELIVERY' | 'COUNTER' = 'DELIVERY') => ({
  status,
  fulfillmentType,
  paymentStatus: 'UNPAID' as const,
})
const demo = (change: Partial<Order>) =>
  ({ status: 'Đã giao', method: 'Giao tận nơi', total: 100, payments: [], history: [], ...change }) as Order

describe('liveOrderFocus', () => {
  it('asks for the next step while the order needs staff', () => {
    expect(liveOrderFocus(live('PENDING'))).toMatchObject({ tone: 'action', title: 'Cần xác nhận đơn' })
    expect(liveOrderFocus(live('CONFIRMED'))).toMatchObject({ tone: 'action', title: 'Cần soạn hàng' })
    expect(liveOrderFocus(live('PREPARING'))).toMatchObject({ tone: 'action', title: 'Cần xếp vào chuyến giao' })
  })

  it('does not ask to schedule a trip for counter orders', () => {
    expect(liveOrderFocus(live('PREPARING', 'COUNTER')).tone).toBe('waiting')
  })

  it('puts a failed delivery ahead of the normal status', () => {
    expect(liveOrderFocus(live('OUT_FOR_DELIVERY'), 'Khách vắng nhà')).toEqual({
      tone: 'alert',
      title: 'Lần giao gần nhất thất bại',
      description: 'Khách vắng nhà',
    })
    expect(liveOrderFocus(live('OUT_FOR_DELIVERY'), null).description).toBe('Tài xế không ghi lý do.')
  })

  it('ignores an old failure once the order is finished', () => {
    expect(liveOrderFocus(live('DELIVERED'), 'Khách vắng nhà').tone).toBe('done')
    expect(liveOrderFocus(live('CANCELLED'), 'Khách vắng nhà').tone).toBe('muted')
  })

  it('reminds about unpaid delivered orders without inventing an amount', () => {
    expect(liveOrderFocus(live('DELIVERED')).description).toBe('Đơn chưa thu đủ tiền.')
    expect(liveOrderFocus({ ...live('COMPLETED'), paymentStatus: 'PAID' }).description).toBeUndefined()
  })
})

describe('demoOrderFocus', () => {
  it('shows the amount still owed after delivery', () => {
    expect(demoOrderFocus(demo({})).title).toContain('Còn phải thu')
    expect(demoOrderFocus(demo({ payments: [{ amount: 100 } as Order['payments'][number]] })).tone).toBe('done')
  })

  it('warns while returned goods wait for inspection', () => {
    expect(demoOrderFocus(demo({ status: 'Giao thất bại' })).title).toBe('Chờ kiểm hàng hoàn')
  })
})
