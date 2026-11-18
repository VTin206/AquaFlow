// @vitest-environment jsdom
import { beforeEach, expect, test } from 'vitest'
import { groupDeliveries, readCollapsed, writeCollapsed } from './deliveryBoard'

beforeEach(() => localStorage.clear())

test('nhớ nhóm đã đóng; bỏ trạng thái lạ và dữ liệu hỏng thì mở hết', () => {
  expect(readCollapsed()).toEqual([])
  writeCollapsed(['Đang giao', 'Chờ xác nhận'])
  expect(readCollapsed()).toEqual(['Đang giao', 'Chờ xác nhận'])
  localStorage.setItem('af.deliveryBoard.collapsed', JSON.stringify(['Đang giao', 'Không có', 3]))
  expect(readCollapsed()).toEqual(['Đang giao'])
  localStorage.setItem('af.deliveryBoard.collapsed', '{hỏng')
  expect(readCollapsed()).toEqual([])
})
import type { Order } from '@/features/orders/types'

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

test('giao thất bại lên đầu, đơn đang giao có lần giao lỗi chuyển sang nhóm thất bại, mỗi nhóm xếp theo giờ hẹn', () => {
  const groups = groupDeliveries(
    [
      order('muon', { status: 'Đang giao', appointment: '2026-11-12T08:00:00Z' }),
      order('som', { status: 'Đang giao', appointment: '2026-11-12T02:00:00Z' }),
      order('chua-hen', { status: 'Đang giao' }),
      order('loi', { status: 'Đang giao', appointment: '2026-11-12T03:00:00Z' }),
      order('tai-quay', { status: 'Đang giao', method: 'Tại quầy' }),
    ],
    new Set(['loi']),
  )
  expect(groups[0].status).toBe('Giao thất bại')
  expect(groups[0].orders.map((item) => item.id)).toEqual(['loi'])
  expect(groups.find((group) => group.status === 'Đang giao')?.orders.map((item) => item.id)).toEqual(['som', 'muon', 'chua-hen'])
  expect(groups.flatMap((group) => group.orders).some((item) => item.id === 'tai-quay')).toBe(false)
})
