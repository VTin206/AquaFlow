import { describe, expect, it } from 'vitest'
import { liveOrderFocus } from './orderFocus'

const live = (status: Parameters<typeof liveOrderFocus>[0]['status'], fulfillmentType: 'DELIVERY' | 'COUNTER' = 'DELIVERY') => ({
  status,
  fulfillmentType,
  paymentStatus: 'UNPAID' as const,
})

describe('liveOrderFocus', () => {
  it('asks for the next step while the order needs staff', () => {
    expect(liveOrderFocus(live('PENDING'))).toMatchObject({ tone: 'action', title: 'Cần xác nhận đơn' })
    expect(liveOrderFocus(live('CONFIRMED'))).toMatchObject({ tone: 'action', title: 'Cần soạn hàng' })
    expect(liveOrderFocus(live('PREPARING'))).toMatchObject({ tone: 'action', title: 'Cần xếp vào chuyến giao' })
  })

  it('does not ask to schedule a trip for counter orders', () => {
    expect(liveOrderFocus(live('PREPARING', 'COUNTER'))).toMatchObject({ tone: 'action', title: 'Chờ bàn giao tại quầy' })
  })

  it('puts a failed delivery ahead of the normal status', () => {
    expect(liveOrderFocus(live('OUT_FOR_DELIVERY'), 'Khách vắng nhà')).toEqual({
      tone: 'alert',
      title: 'Lần giao gần nhất thất bại',
      description: 'Khách vắng nhà',
    })
    expect(liveOrderFocus(live('OUT_FOR_DELIVERY'), null).description).toBe('Tài xế không ghi lý do.')
  })

  it('warns when a dispatched order has no trip to record a result on', () => {
    expect(liveOrderFocus(live('OUT_FOR_DELIVERY'), undefined, true).tone).toBe('alert')
    expect(liveOrderFocus(live('PREPARING'), undefined, true).tone).toBe('action')
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
