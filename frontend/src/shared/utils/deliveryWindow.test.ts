import dayjs from 'dayjs'
import { expect, test } from 'vitest'
import {
  deliveryDeadline,
  formatDeliveryWindow,
  formatDeliveryWindowShort,
  slotOf,
  slotStarted,
  slotWindow,
  withWindowEnd,
} from './deliveryWindow'

const day = dayjs('2030-03-04T00:00:00')

test('khung giờ là bốn khoảng cố định trong ngày đã chọn', () => {
  const { from, until } = slotWindow(day, 'afternoon')
  expect(from.format('YYYY-MM-DD HH:mm')).toBe('2030-03-04 14:00')
  expect(until.format('YYYY-MM-DD HH:mm')).toBe('2030-03-04 17:00')
  expect(slotWindow(day, 'evening').until.format('HH:mm')).toBe('20:00')
})

test('khung đã bắt đầu thì không chọn được', () => {
  const now = dayjs('2030-03-04T11:30:00')
  expect(slotStarted(day, 'morning', now)).toBe(true)
  expect(slotStarted(day, 'noon', now)).toBe(true)
  expect(slotStarted(day, 'afternoon', now)).toBe(false)
  expect(slotStarted(day.add(1, 'day'), 'morning', now)).toBe(false)
})

test('đọc lại khung của đơn để sửa; giờ lẻ hoặc thiếu cuối khung thì không khớp khung nào', () => {
  const { from, until } = slotWindow(day, 'noon')
  expect(slotOf(from.toISOString(), until.toISOString())?.key).toBe('noon')
  expect(slotOf(day.hour(14).minute(30).toISOString(), until.toISOString())).toBeUndefined()
  expect(slotOf(from.toISOString(), null)).toBeUndefined()
})

test('hạn giao là cuối khung; đơn hẹn một mốc giữ mốc đó', () => {
  expect(deliveryDeadline('2030-03-04T07:00:00Z', '2030-03-04T10:00:00Z')).toBe('2030-03-04T10:00:00Z')
  expect(deliveryDeadline('2030-03-04T07:00:00Z', null)).toBe('2030-03-04T07:00:00Z')
  expect(deliveryDeadline(undefined, undefined)).toBeUndefined()
})

test('hiển thị khung "14:00–17:00", mốc giờ cũ giữ như trước', () => {
  const { from, until } = slotWindow(day, 'afternoon')
  expect(formatDeliveryWindow(from.toISOString(), until.toISOString())).toBe('14:00–17:00 04/03/2030')
  expect(formatDeliveryWindowShort(from.toISOString(), until.toISOString())).toBe('14:00–17:00 04/03')
  expect(formatDeliveryWindowShort(from.toISOString())).toBe('14:00 04/03')
  expect(withWindowEnd('Mai 14:00', until.toISOString())).toBe('Mai 14:00–17:00')
  // Nhãn khác năm không có giờ thì không nối giờ kết thúc.
  expect(withWindowEnd('04/03/2030', until.toISOString())).toBe('04/03/2030')
})
