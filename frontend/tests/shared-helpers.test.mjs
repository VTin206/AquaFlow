import { test } from 'vitest'
import assert from 'node:assert/strict'

// Các hàm dùng chung không phụ thuộc dữ liệu: khoảng kỳ báo cáo, mã VietQR, tính trễ hẹn.
const { minutesLate, isOverdue } = await import('/src/features/orders/types.ts')
const { vietQrPayload, transferNote } = await import('/src/shared/payment/vietqr.ts')
const { previousRange } = await import('/src/features/reports/reportService.ts')
const { groupRevenue, autoGranularity } = await import('/src/features/reports/periods.ts')

test('period helpers: previous period has the same length; revenue groups by week and month', async () => {
  assert.deepEqual(previousRange({ from: '2026-10-01', to: '2026-10-31' }), { from: '2026-08-31', to: '2026-09-30' })
  assert.deepEqual(previousRange({ from: '2026-10-20', to: '2026-10-20' }), { from: '2026-10-19', to: '2026-10-19' })
  assert.equal(autoGranularity({ from: '2026-10-01', to: '2026-10-31' }), 'day')
  assert.equal(autoGranularity({ from: '2026-08-01', to: '2026-10-31' }), 'week')
  assert.equal(autoGranularity({ from: '2026-01-01', to: '2026-10-31' }), 'month')
  const days = ['2026-09-30', '2026-10-01', '2026-10-04', '2026-10-05'].map((date, index) => ({
    date,
    revenue: (index + 1) * 1000,
    collected: 0,
    orders: 0,
  }))
  // 30/9 (T4) tới 4/10 (CN) cùng một tuần bắt đầu 28/9; 5/10 là thứ Hai tuần sau.
  assert.deepEqual(
    groupRevenue(days, 'week').map((bucket) => [bucket.key, bucket.revenue]),
    [
      ['2026-09-28', 6000],
      ['2026-10-05', 4000],
    ],
  )
  assert.deepEqual(
    groupRevenue(days, 'month').map((bucket) => [bucket.label, bucket.revenue]),
    [
      ['T9/2026', 1000],
      ['T10/2026', 9000],
    ],
  )
})

test('VietQR payload: EMVCo fields, amount, ASCII note and CRC', async () => {
  const payload = vietQrPayload({ bin: '970436', account: '0071000123456', amount: 185000, note: 'AF-1070' })
  assert.ok(payload.startsWith('000201010212'))
  assert.ok(payload.includes('0006970436011300710001234560208QRIBFTTA'))
  assert.ok(payload.includes('5406185000'))
  assert.ok(payload.includes('0806AF1070'))
  assert.match(payload, /6304[0-9A-F]{4}$/)
  assert.equal(transferNote('Thanh toán đơn AF-1070'), 'Thanh toan don AF1070')
})

test('lateness is measured against the appointment', () => {
  const now = Date.parse('2026-11-12T08:00:00Z')
  const appointment = new Date(now + 60_000).toISOString()
  const order = { method: 'Giao tận nơi', status: 'Đang giao', appointment }
  assert.equal(isOverdue(order, now), false)
  assert.ok(isOverdue(order, now + 30 * 60_000))
  assert.equal(minutesLate(order, now + 31 * 60_000), 30)
  const delivered = { ...order, status: 'Đã giao', deliveredAt: new Date(Date.parse(appointment) + 15 * 60_000).toISOString() }
  assert.equal(minutesLate(delivered), 15)
  assert.equal(isOverdue(delivered), false)
})
