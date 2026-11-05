// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LiveOrder } from '@/features/live/orderApi'
import type { StoreSettings } from '@/features/settings/types'
import { fromLiveOrder } from './orderData'
import { orderConfirmationMessage } from './orderMessage'
import { DeliverySlipDocument, InvoiceDocument } from './print/OrderDocuments'
import { knownAmountDue, type Order } from './types'

vi.mock('@/shared/features', async (original) => ({
  ...(await original<typeof import('@/shared/features')>()),
  useFeature: () => false,
}))
vi.mock('@/shared/payment/TransferQr', () => ({ TransferQr: ({ note }: { note: string }) => <div>QR {note}</div> }))

const money = (text: string | null | undefined) => text?.replace(/\s/g, ' ')
const liveOrder: LiveOrder = {
  id: 7,
  orderCode: 'DH-007',
  customerId: 1,
  createdBy: 1,
  channel: 'PHONE',
  fulfillmentType: 'DELIVERY',
  status: 'PREPARING',
  paymentStatus: 'PAID',
  recipientName: 'Lan',
  recipientPhone: '0901234567',
  deliveryAddress: '12 Lê Lợi',
  deliveryArea: null,
  requestedDeliveryAt: null,
  subtotal: 100000,
  discountAmount: 10000,
  deliveryFee: 5000,
  total: 95000,
  createdAt: '2026-11-05T01:00:00Z',
  confirmedAt: null,
  cancelledAt: null,
  note: null,
  items: [{ id: 1, productId: 9, quantity: 2, unitPrice: 50000, lineTotal: 100000 }],
}
const viewOf = (paymentStatus: LiveOrder['paymentStatus']) =>
  fromLiveOrder({ ...liveOrder, paymentStatus }, [{ id: 9, name: 'Nước 20L', unit: 'Bình' } as never])
const settings = { storeName: 'Cửa hàng A', bankAccount: '123', bankName: 'VCB', bankHolder: 'A' } as StoreSettings

afterEach(cleanup)

describe('knownAmountDue', () => {
  it('uses the backend payment status when there are no payment records', () => {
    expect(knownAmountDue(viewOf('UNPAID'))).toBe(95000)
    expect(knownAmountDue(viewOf('PAID'))).toBe(0)
    expect(knownAmountDue(viewOf('REFUNDED'))).toBe(0)
    expect(knownAmountDue(viewOf('PARTIALLY_PAID'))).toBeNull()
  })

  it('uses payment records for orders without a backend status', () => {
    const order = { total: 100, payments: [{ amount: 30 }] } as Order
    expect(knownAmountDue(order)).toBe(70)
  })
})

describe('order documents for live orders', () => {
  it('prints the order code, discount and nothing owed on a paid invoice', () => {
    const { container } = render(<InvoiceDocument order={viewOf('PAID')} settings={settings} />)
    expect(screen.getByText('DH-007')).toBeTruthy()
    expect(screen.getByText('Giảm giá')).toBeTruthy()
    expect(screen.getByText('Đã thanh toán')).toBeTruthy()
    const dueRow = [...container.querySelectorAll('tr')].find((row) => row.textContent?.startsWith('Còn phải thu'))
    expect(money(dueRow?.textContent)).toContain('Còn phải thu0')
    expect(screen.queryByText(/^QR/)).toBeNull()
  })

  it('does not invent an amount for a partially paid invoice', () => {
    const { container } = render(<InvoiceDocument order={viewOf('PARTIALLY_PAID')} settings={settings} />)
    expect(screen.getByText('Thanh toán một phần')).toBeTruthy()
    expect(container.textContent).not.toContain('Còn phải thu')
    expect(screen.queryByText(/^QR/)).toBeNull()
  })

  it('leaves the amount blank and omits the mock deposit on a partially paid slip', () => {
    const { container } = render(<DeliverySlipDocument order={viewOf('PARTIALLY_PAID')} settings={settings} />)
    expect(screen.getByText('Tiền cần thu').parentElement?.querySelector('.af-doc-blank')).toBeTruthy()
    expect(container.textContent).toContain('Vỏ rỗng cần đổi')
    expect(container.textContent).not.toContain('Cọc thu thêm')
  })
})

describe('orderConfirmationMessage', () => {
  it('lists the order and uses the backend code', () => {
    const text = orderConfirmationMessage(viewOf('UNPAID'), 'Cửa hàng A')
    expect(text).toContain('Chào anh/chị Lan, Cửa hàng A xác nhận đơn DH-007:')
    expect(text).toContain('- Nước 20L × 2')
    expect(text).toContain('Giảm giá')
    expect(text).toContain('Giao đến: 12 Lê Lợi')
  })

  it('does not address a walk-in customer by the placeholder name', () => {
    const order = fromLiveOrder({ ...liveOrder, recipientName: null, fulfillmentType: 'COUNTER' }, [])
    const text = orderConfirmationMessage(order)
    expect(text.startsWith('Chào anh/chị, cửa hàng xác nhận')).toBe(true)
    expect(text).toContain('Nhận hàng tại cửa hàng')
  })
})
