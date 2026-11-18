import { expect, test } from 'vitest'

const { compareDeliveryDue, deliveryTimingOf, lateLabel } = await import('/src/features/orders/types.ts')

const now = new Date(2026, 9, 31, 10, 0).getTime()
const at = (hours, minutes = 0, dayOffset = 0) => new Date(2026, 9, 31 + dayOffset, hours, minutes).toISOString()
const order = (overrides = {}) => ({
  id: 'DH-1',
  customer: 'Khách',
  phone: '0901000000',
  address: '1 Đường A',
  channel: 'Điện thoại',
  method: 'Giao tận nơi',
  status: 'Đã xác nhận',
  time: '09:00',
  lines: [],
  payments: [],
  history: [{ at: at(9), by: 'NV', message: 'Tạo đơn' }],
  ...overrides,
})

test('main line is the appointment, toned by urgency; sub line is when it was ordered', () => {
  expect(deliveryTimingOf(order({ appointment: at(14) }), now)).toMatchObject({
    main: { label: '14:00', tone: 'normal' },
    sub: { label: 'đặt 09:00' },
  })
  expect(deliveryTimingOf(order({ appointment: at(10, 30) }), now).main.tone).toBe('warning')
  expect(deliveryTimingOf(order({ appointment: at(9, 30) }), now).main.tone).toBe('danger')
  expect(deliveryTimingOf(order({ appointment: at(8, 0, 1) }), now).main.label).toBe('Mai 08:00')
})

test('no appointment, counter sale, delivered and pending orders', () => {
  expect(deliveryTimingOf(order(), now).main.label).toBe('Giao sớm nhất')
  expect(deliveryTimingOf(order({ method: 'Tại quầy' }), now).main).toMatchObject({ label: 'Tại quầy', tone: 'muted' })
  expect(deliveryTimingOf(order({ status: 'Đã giao', deliveredAt: at(9, 45) }), now).main).toMatchObject({
    label: 'Đã giao 09:45',
    tone: 'muted',
  })
  expect(
    deliveryTimingOf(order({ status: 'Chờ xác nhận', history: [{ at: at(9, 35), by: 'Web', message: 'Tạo đơn' }] }), now).sub.label,
  ).toBe('chờ 25 phút')
  expect(
    deliveryTimingOf(order({ status: 'Chờ xác nhận', history: [{ at: at(9, 0, -15), by: 'Web', message: 'Tạo đơn' }] }), now).sub.label,
  ).toBe('chờ 15 ngày')
})

test('late label stays readable for long delays', () => {
  expect(lateLabel(25)).toBe('25 phút')
  expect(lateLabel(120)).toBe('2 giờ')
  expect(lateLabel(125)).toBe('2 giờ 5 phút')
  expect(lateLabel(1439)).toBe('23 giờ 59 phút')
  expect(lateLabel(1440)).toBe('1 ngày')
  expect(lateLabel(29609)).toBe('20 ngày')
})

test('sorting puts open orders first by due time, then finished orders newest first', () => {
  const late = order({ id: 'late', appointment: at(9, 30) })
  const soon = order({ id: 'soon', appointment: at(11) })
  const asap = order({ id: 'asap', history: [{ at: at(9, 50), by: 'NV', message: 'Tạo đơn' }] })
  const doneOld = order({ id: 'done-old', status: 'Đã giao', history: [{ at: at(7), by: 'NV', message: 'Tạo đơn' }] })
  const doneNew = order({ id: 'done-new', status: 'Đã giao', history: [{ at: at(8), by: 'NV', message: 'Tạo đơn' }] })
  const sorted = [doneOld, soon, doneNew, asap, late].sort(compareDeliveryDue).map((item) => item.id)
  expect(sorted).toEqual(['late', 'asap', 'soon', 'done-new', 'done-old'])
})

test('bảng Đơn hàng mặc định sắp theo mức ưu tiên xử lý', async () => {
  const { compareOrderPriority, orderPriority } = await import('/src/features/orders/types.ts')
  const created = (hours, minutes = 0, dayOffset = 0) => [{ at: at(hours, minutes, dayOffset), by: 'NV', message: 'Tạo đơn' }]
  const failed = order({ id: 'failed', status: 'Giao thất bại', history: created(9, 55) })
  // Đơn thật: BE giữ trạng thái Đang giao và gửi cờ lastAttemptFailed.
  const failedLive = order({ id: 'failed-live', status: 'Đang giao', lastAttemptFailed: true, history: created(9, 58) })
  const lateLong = order({ id: 'late-long', appointment: at(7), history: created(6) })
  const lateShort = order({ id: 'late-short', status: 'Đang chuẩn bị', appointment: at(9, 30), history: created(8) })
  const pendingOld = order({ id: 'pending-old', status: 'Chờ xác nhận', method: 'Tại quầy', history: created(8) })
  const pendingNew = order({ id: 'pending-new', status: 'Chờ xác nhận', method: 'Tại quầy', history: created(9, 50) })
  const soon = order({ id: 'soon', appointment: at(11), history: created(9, 40) })
  const later = order({ id: 'later', appointment: at(15), history: created(9) })
  const noTime = order({ id: 'no-time', status: 'Đang giao', history: created(6) })
  const owing = order({
    id: 'owing',
    status: 'Đã giao',
    total: 100000,
    paymentBalance: { paid: 0, due: 100000, refundDue: 0 },
    history: created(5),
  })
  const paidNew = order({ id: 'paid-new', status: 'Đã giao', paymentBalance: { paid: 1, due: 0, refundDue: 0 }, history: created(8) })
  const cancelledOld = order({ id: 'cancelled-old', status: 'Đã hủy', history: created(7, 0, -1) })

  expect([lateShort, owing, pendingNew, failedLive].map((item) => orderPriority(item, now))).toEqual([1, 4, 2, 0])
  const sorted = [cancelledOld, noTime, owing, later, pendingNew, failedLive, failed, paidNew, soon, lateShort, pendingOld, lateLong]
    .sort((a, b) => compareOrderPriority(a, b, now))
    .map((item) => item.id)
  // Đơn không hẹn giờ ("giao sớm nhất") tính từ lúc đặt, nên đứng trước đơn hẹn giờ muộn hơn.
  expect(sorted).toEqual([
    'failed',
    'failed-live',
    'late-long',
    'late-short',
    'pending-old',
    'pending-new',
    'no-time',
    'soon',
    'later',
    'owing',
    'paid-new',
    'cancelled-old',
  ])
})
