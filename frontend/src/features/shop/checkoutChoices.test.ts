import { expect, test } from 'vitest'
import { CUSTOMER_NOTE_MAX, ORDER_NOTE_MAX, checkoutNote, stairFloors } from './checkoutChoices'

test('ghi nơi nhận và cách trả tiền vào đầu ghi chú, thanh toán khi nhận hàng thì không ghi', () => {
  expect(checkoutNote('room', 'cod')).toBe('Giao tận phòng')
  expect(checkoutNote('gate', 'cod', '  gọi trước  ')).toBe('Giao tới cổng/sảnh · gọi trước')
  expect(checkoutNote('room', 'transfer', 'tầng 3')).toBe('Giao tận phòng · Muốn chuyển khoản trước · tầng 3')
  expect(checkoutNote('gate', 'transfer', 'gọi trước', 'deposit')).toBe('Giao tới cổng/sảnh · Chưa có vỏ, cọc vỏ mới · Muốn chuyển khoản trước · gọi trước')
  expect(checkoutNote('room', 'cod', undefined, 'exchange')).toBe('Giao tận phòng')
})

test('ghi chú dài nhất của khách vẫn vừa giới hạn của đơn', () => {
  expect(checkoutNote('gate', 'transfer', 'x'.repeat(CUSTOMER_NOTE_MAX)).length).toBeLessThanOrEqual(ORDER_NOTE_MAX)
  expect(checkoutNote('gate', 'transfer', 'x'.repeat(CUSTOMER_NOTE_MAX)).endsWith('x')).toBe(true)
})

test('giao ở cổng, sảnh thì không tính tầng thang bộ', () => {
  expect(stairFloors('gate', 4)).toBe(0)
  expect(stairFloors('room', 4)).toBe(4)
})
