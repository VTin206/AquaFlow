import { expect, test } from 'vitest'
import { deliveryToday } from './dashboardData'
import type { Order } from '@/features/orders/types'

const now = new Date(2026, 10, 12, 10, 0)
const at = (day: number, hour: number) => new Date(2026, 10, day, hour, 0).toISOString()
const order = (id: string, patch: Partial<Order>): Order =>
  ({
    id,
    customer: id,
    phone: '',
    address: '',
    items: '',
    total: 0,
    time: '',
    status: 'Đã xác nhận',
    method: 'Giao tận nơi',
    channel: 'Điện thoại',
    lines: [],
    deliveryFee: 0,
    payments: [],
    history: [],
    stockReserved: false,
    ...patch,
  }) as Order

test('còn phải giao gồm đơn hẹn hôm nay, hẹn ngày trước còn sót và đơn đang trên đường; xếp theo giờ hẹn', () => {
  const result = deliveryToday(
    [
      order('chieu', { appointment: at(12, 15) }),
      order('sot-hom-qua', { appointment: at(11, 9), status: 'Đang chuẩn bị' }),
      order('dang-giao-khong-hen', { status: 'Đang giao' }),
      order('ngay-mai', { appointment: at(13, 9) }),
      order('tai-quay', { appointment: at(12, 9), method: 'Tại quầy' }),
      order('da-huy', { appointment: at(12, 9), status: 'Đã hủy' }),
      order('that-bai', { appointment: at(12, 8), status: 'Giao thất bại' }),
    ],
    now,
  )
  expect(result.remaining.map((item) => item.id)).toEqual(['sot-hom-qua', 'chieu', 'dang-giao-khong-hen'])
  expect(result.late).toBe(1)
})

test('đã giao hôm nay dùng giờ giao, thiếu giờ giao thì dùng ngày hẹn', () => {
  const result = deliveryToday(
    [
      order('giao-sang', { status: 'Đã giao', deliveredAt: at(12, 8), appointment: at(11, 17) }),
      order('hoan-tat-theo-hen', { status: 'Đã hoàn tất', appointment: at(12, 7) }),
      order('giao-hom-qua', { status: 'Đã giao', deliveredAt: at(11, 16), appointment: at(12, 9) }),
    ],
    now,
  )
  expect(result.delivered).toBe(2)
  expect(result.remaining).toEqual([])
})
