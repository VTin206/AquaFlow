import { expect, test } from 'vitest'
import { toPublicOrder, type LiveTrackedOrder } from './orderTrackingApi'

const base: LiveTrackedOrder = {
  orderCode: 'AF-001070',
  status: 'OUT_FOR_DELIVERY',
  fulfillmentType: 'DELIVERY',
  paymentStatus: 'UNPAID',
  deliveryFailed: false,
  recipientName: 'Nguyễn Văn An',
  recipientPhone: '090****567',
  deliveryAddress: '123 Nguyễn Trãi',
  deliveryArea: 'Phường Chợ Quán',
  requestedDeliveryAt: null,
  subtotal: 60000,
  discountAmount: 0,
  deliveryFee: 10000,
  total: 70000,
  paid: 20000,
  due: 50000,
  createdAt: '2026-11-10T08:00:00+07:00',
  confirmedAt: '2026-11-10T08:05:00+07:00',
  deliveredAt: null,
  cancelledAt: null,
  trackingToken: 'token-1234567890abcdef',
  items: [{ productId: 3, productName: 'Bình 20L', unit: 'Bình', quantity: 2, unitPrice: 30000, lineTotal: 60000 }],
}

test('chuyển đơn tra cứu từ BE sang dạng trang theo dõi đang dùng', () => {
  expect(toPublicOrder(base)).toEqual({
    id: 'AF-001070',
    customer: 'Nguyễn Văn An',
    address: '123 Nguyễn Trãi, Phường Chợ Quán',
    status: 'Đang giao',
    method: 'Giao tận nơi',
    lines: [{ productId: '3', name: 'Bình 20L', unit: 'Bình', quantity: 2, unitPrice: 30000 }],
    deliveryFee: 10000,
    total: 70000,
    paid: 20000,
    due: 50000,
    appointment: undefined,
    createdAt: '2026-11-10T08:00:00+07:00',
    deliveredAt: undefined,
    trackingToken: 'token-1234567890abcdef',
  })
})

test('đơn đang giao bị báo giao thất bại thì hiện "Giao thất bại"', () => {
  expect(toPublicOrder({ ...base, deliveryFailed: true }).status).toBe('Giao thất bại')
  expect(toPublicOrder({ ...base, status: 'DELIVERED', deliveryFailed: true }).status).toBe('Đã giao')
})
