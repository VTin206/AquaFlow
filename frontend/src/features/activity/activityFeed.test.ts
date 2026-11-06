import dayjs from 'dayjs'
import { expect, test } from 'vitest'
import { dayLabel, fromLive, groupByDay, initials, isImportantActivity, rangeBounds, relativeTime } from './activityFeed'

const now = dayjs('2026-11-06T10:00:00')

test('đánh dấu đúng thao tác quan trọng, không nhầm việc thường ngày', () => {
  expect(isImportantActivity('Đổi trạng thái đơn → Đã hủy', 'transitionStatus', 'ORDER')).toBe(true)
  expect(isImportantActivity('Hoàn 100.000 ₫ cho khách · Tiền mặt')).toBe(true)
  expect(isImportantActivity('Ngừng kinh doanh Nước 19L')).toBe(true)
  expect(isImportantActivity('Cập nhật', 'UPDATE', 'STAFF_ACCOUNT')).toBe(true)
  expect(isImportantActivity('Kết thúc / đối soát chuyến', 'settle', 'DELIVERY_TRIP')).toBe(true)
  expect(isImportantActivity('Xác nhận đơn, chốt giá và giữ hàng.')).toBe(false)
  expect(isImportantActivity('Đổi trạng thái đơn → Đang chuẩn bị', 'transitionStatus', 'ORDER')).toBe(false)
  expect(isImportantActivity('Tạo mới', 'create', 'DELIVERY_TRIP')).toBe(false)
})

test('chuyển dòng nhật ký thật thành dạng chung, kể cả tài khoản nhân viên', () => {
  const item = fromLive({ id: 7, at: '2026-11-06T02:00:00Z', actorId: 1, actorName: 'Admin', area: 'OTHER', action: 'UPDATE', entityType: 'STAFF_ACCOUNT', entityId: 3, target: 'STAFF_ACCOUNT #3', reason: null })
  expect(item).toMatchObject({ id: '7', area: 'Khác', target: 'Tài khoản nhân viên #3', description: 'Cập nhật', entity: { type: 'STAFF_ACCOUNT', id: '3' }, important: true })
})

test('khoảng thời gian nhanh tính theo ngày, lấy trọn ngày cuối', () => {
  expect(rangeBounds('today', null, now).from?.format('YYYY-MM-DD HH:mm')).toBe('2026-11-06 00:00')
  expect(rangeBounds('7d', null, now).from?.format('YYYY-MM-DD')).toBe('2026-10-31')
  expect(rangeBounds('7d', null, now).to?.format('YYYY-MM-DD HH:mm')).toBe('2026-11-07 00:00')
  expect(rangeBounds('all', null, now)).toEqual({ from: undefined, to: undefined })
})

test('nhóm theo ngày và ghi thời gian dễ đọc', () => {
  const at = (iso: string) => ({ id: iso, at: iso, actor: 'A', area: 'Đơn hàng', description: '', target: '', important: false })
  const groups = groupByDay([at('2026-11-06T09:55:00'), at('2026-11-06T08:00:00'), at('2026-11-05T20:00:00'), at('2026-11-02T08:00:00')], now)
  expect(groups.map((group) => [group.label, group.items.length])).toEqual([['Hôm nay', 2], ['Hôm qua', 1], ['Thứ Hai, 02/11/2026', 1]])
  expect(dayLabel(dayjs('2026-11-06T01:00:00'), now)).toBe('Hôm nay')
  expect(relativeTime('2026-11-06T09:55:00', now)).toBe('5 phút trước')
  expect(relativeTime('2026-11-06T07:00:00', now)).toBe('3 giờ trước')
  expect(relativeTime('2026-11-05T20:15:00', now)).toBe('20:15')
  expect(initials('Nguyễn Văn An')).toBe('VA')
  expect(initials('Hệ thống / khách vãng lai')).toBe('VL')
})
