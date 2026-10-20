import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { setTimeout } from 'node:timers'
import console from 'node:console'

// Hủy/hoàn tiền, trả hàng, phân quyền, đơn website, nhật ký và báo cáo theo kỳ trên cùng service của UI.
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
globalThis.window = { setTimeout: (callback) => setTimeout(callback, 0) }
const load = (path) => server.ssrLoadModule(path)
const { orderService } = await load('/src/features/orders/orderService.ts')
const { reportService } = await load('/src/features/reports/reportService.ts')
const { db } = await load('/src/mocks/db.ts')
const { setMockSession } = await load('/src/mocks/session.ts')
const { amountDue, paidAmount, minutesLate, isOverdue } = await load('/src/features/orders/types.ts')
const { vietQrPayload, transferNote } = await load('/src/shared/payment/vietqr.ts')
const { previousRange } = await load('/src/features/reports/reportService.ts')
const { groupRevenue, autoGranularity } = await load('/src/features/reports/periods.ts')

const seed = globalThis.structuredClone(db)
seed.products = [
  { id: 'P-001', name: 'Bình nước kiểm thử 20L', brand: 'Kiểm thử', unit: 'Bình', stock: 20, threshold: 5, price: 70000, expiry: '31/12/2099', sku: 'TEST-20L' },
  { id: 'P-003', name: 'Thùng nước kiểm thử', brand: 'Kiểm thử', unit: 'Thùng', stock: 30, threshold: 5, price: 90000, expiry: '31/12/2099', sku: 'TEST-500' },
]
seed.orders = []
seed.archivedOrders = []
seed.activity = []
seed.lots = []
seed.receipts = []
seed.trips = []
seed.bottleLedger = []

let passed = 0
const admin = () => setMockSession({ name: 'Chủ kiểm thử', role: 'ADMIN' })
const sales = () => setMockSession({ name: 'Bán hàng kiểm thử', role: 'SALES_STAFF' })
const driver = () => setMockSession({ name: 'Tài xế kiểm thử', role: 'DELIVERY_STAFF' })
const test = async (name, run) => {
  Object.assign(db, globalThis.structuredClone(seed))
  admin()
  await run()
  passed++
  console.log(`PASS ${name}`)
}
const stock = (id) => db.products.find((product) => product.id === id).stock
const draft = (overrides = {}) => ({
  customer: 'Khách kiểm thử',
  phone: '0903456128',
  address: '123 Đường A',
  method: 'Giao tận nơi',
  channel: 'Điện thoại',
  deliveryFee: 10000,
  lines: [{ productId: 'P-003', quantity: 2 }],
  ...overrides,
})
/** Tạo đơn, xác nhận, giao thành công; trả về đơn sau cùng. */
async function deliveredOrder(overrides) {
  const order = await orderService.create(draft(overrides))
  await orderService.advanceStatus(order.id)
  await orderService.advanceStatus(order.id)
  return orderService.receive(order.id, { success: true, receiver: 'Khách' })
}

try {
  await test('paid order cancel needs owner and refunds everything in one step', async () => {
    const order = await orderService.create(draft())
    await orderService.advanceStatus(order.id)
    await orderService.pay(order.id, { amount: 50000, method: 'Tiền mặt' })
    sales()
    await assert.rejects(orderService.cancel(order.id, 'Khách đổi ý', { method: 'Tiền mặt' }), /không có quyền hoàn tiền/)
    admin()
    await assert.rejects(orderService.cancel(order.id, 'Khách đổi ý'), /cách hoàn tiền/)
    await assert.rejects(orderService.cancel(order.id, 'Khách đổi ý', { method: 'Chuyển khoản' }), /mã giao dịch/)
    assert.equal(db.orders[0].status, 'Đang chuẩn bị', 'failed cancel must not change the order')
    const before = stock('P-003')
    const cancelled = await orderService.cancel(order.id, 'Khách đổi ý', { method: 'Tiền mặt' })
    assert.equal(cancelled.status, 'Đã hủy')
    assert.equal(paidAmount(cancelled), 0)
    assert.equal(cancelled.payments.at(-1).refund, true)
    assert.equal(stock('P-003'), before + 2)
  })

  await test('cancel after failed delivery restocks; on-the-road orders cannot be cancelled', async () => {
    const order = await orderService.create(draft())
    await orderService.advanceStatus(order.id)
    await orderService.advanceStatus(order.id)
    await assert.rejects(orderService.cancel(order.id, 'Khách không nhận'), /đang trên đường giao/)
    await orderService.receive(order.id, { success: false, reason: 'Không liên hệ được' })
    const before = stock('P-003')
    const cancelled = await orderService.cancel(order.id, 'Khách không nhận')
    assert.equal(cancelled.status, 'Đã hủy')
    assert.equal(stock('P-003'), before + 2)
    assert.match(cancelled.history.at(-1).message, /nhập lại kho/)
  })

  await test('returns reduce order value, refund only the overpaid part, restock is optional', async () => {
    let order = await deliveredOrder()
    assert.equal(order.total, 190000)
    await orderService.pay(order.id, { amount: 190000, method: 'Tiền mặt' })
    sales()
    await assert.rejects(orderService.returnItems(order.id, { lines: [{ productId: 'P-003', quantity: 1 }], reason: 'Hỏng', restock: false }), /quyền/)
    admin()
    await assert.rejects(orderService.returnItems(order.id, { lines: [{ productId: 'P-003', quantity: 3 }], reason: 'Hỏng', restock: false }), /chỉ còn 2/)
    await assert.rejects(orderService.returnItems(order.id, { lines: [{ productId: 'P-003', quantity: 1 }], reason: 'Hỏng', restock: false }), /chọn cách hoàn tiền/)
    const before = stock('P-003')
    order = await orderService.returnItems(order.id, { lines: [{ productId: 'P-003', quantity: 1 }], reason: 'Thùng móp', restock: false, refundMethod: 'Tiền mặt' })
    assert.equal(order.total, 100000)
    assert.equal(paidAmount(order), 100000)
    assert.equal(amountDue(order), 0)
    assert.equal(stock('P-003'), before, 'damaged goods do not return to stock')
    // Đơn chưa trả hết tiền: trả hàng chỉ giảm số còn phải thu, không hoàn.
    let unpaid = await deliveredOrder()
    const beforeRestock = stock('P-003')
    unpaid = await orderService.returnItems(unpaid.id, { lines: [{ productId: 'P-003', quantity: 1 }], reason: 'Giao dư', restock: true })
    assert.equal(amountDue(unpaid), 100000)
    assert.equal(unpaid.payments.length, 0)
    assert.equal(stock('P-003'), beforeRestock + 1)
    await assert.rejects(orderService.returnItems(unpaid.id, { lines: [{ productId: 'P-003', quantity: 2 }], reason: 'x', restock: true }), /chỉ còn 1/)
  })

  await test('roles: delivery staff cannot create or confirm orders but can collect money', async () => {
    driver()
    await assert.rejects(orderService.create(draft()), /quyền/)
    admin()
    const order = await orderService.create(draft())
    driver()
    await assert.rejects(orderService.advanceStatus(order.id), /quyền/)
    admin()
    await orderService.advanceStatus(order.id)
    driver()
    const paid = await orderService.pay(order.id, { amount: 10000, method: 'Tiền mặt' })
    assert.equal(paid.payments[0].by, 'Tài xế kiểm thử')
    assert.equal(paid.history.at(-1).by, 'Tài xế kiểm thử')
    assert.ok(db.activity.some((entry) => entry.by === 'Tài xế kiểm thử' && entry.area === 'Thanh toán'))
  })

  await test('website orders: fee from policy, private tracking link, lookup needs matching phone', async () => {
    const placed = await orderService.placeWebOrder({ customer: 'Khách web', phone: '0911222333', address: '9 Đường B', floor: 2, lines: [{ productId: 'P-001', quantity: 2 }] })
    const order = db.orders.find((item) => item.id === placed.id)
    assert.equal(order.channel, 'Website')
    assert.equal(order.status, 'Chờ xác nhận')
    // Dưới 3 bình: 15.000 phí nhỏ + lầu 2 là 4.000/bình × 2 bình.
    assert.equal(order.deliveryFee, 23000)
    assert.match(order.history[0].by, /khách, website/)
    assert.equal(placed.history, undefined, 'public view hides internal history')
    assert.ok(placed.trackingToken && placed.trackingToken.length >= 16)
    assert.equal((await orderService.track({ token: placed.trackingToken })).id, order.id)
    assert.equal((await orderService.track({ id: order.id.toLowerCase(), phone: '0911 222 333' })).id, order.id)
    await assert.rejects(orderService.track({ id: order.id, phone: '0900000000' }), /Không tìm thấy/)
    await assert.rejects(orderService.track({ token: 'khong-dung' }), /Không tìm thấy/)
  })

  await test('lateness is measured against the appointment', async () => {
    const appointment = new Date(Date.now() + 60_000).toISOString()
    const order = await orderService.create(draft({ appointment }))
    await orderService.advanceStatus(order.id)
    const stored = db.orders.find((item) => item.id === order.id)
    assert.equal(isOverdue(stored), false)
    assert.ok(isOverdue(stored, Date.now() + 30 * 60_000))
    assert.equal(minutesLate(stored, Date.now() + 31 * 60_000), 30)
    stored.status = 'Đã giao'
    stored.deliveredAt = new Date(Date.parse(appointment) + 15 * 60_000).toISOString()
    assert.equal(minutesLate(stored), 15)
    assert.equal(isOverdue(stored), false)
  })

  await test('period report: revenue on delivery day, cash net of refunds, profit from lot cost', async () => {
    const today = new Date().toLocaleDateString('sv-SE')
    db.lots = [{ id: 'L1', productId: 'P-003', lotCode: 'L1', received: 10, costPrice: 60000, receiptId: 'PN-1', receivedAt: today }]
    const order = await deliveredOrder()
    await orderService.pay(order.id, { amount: 190000, method: 'Chuyển khoản', reference: 'FT1' })
    await orderService.returnItems(order.id, { lines: [{ productId: 'P-003', quantity: 1 }], reason: 'Hỏng', restock: false, refundMethod: 'Tiền mặt' })
    const report = await reportService.summary({ from: today, to: today })
    assert.equal(report.sales.goods, 180000)
    assert.equal(report.sales.deliveryFees, 10000)
    assert.equal(report.sales.returnsValue, 90000)
    assert.equal(report.sales.net, 100000)
    assert.equal(report.days[0].revenue, 100000)
    assert.equal(report.cash.transfer, 190000)
    assert.equal(report.cash.refunds, 90000)
    assert.equal(report.cash.collected, 100000)
    const row = report.products.find((item) => item.productId === 'P-003')
    assert.equal(row.sold, 1)
    assert.equal(row.returned, 1)
    assert.equal(report.profit.cost, 60000)
    assert.equal(report.days.length, 1)
    await assert.rejects(reportService.summary({ from: today, to: '2000-01-01' }), /không hợp lệ/)
  })

  await test('period report: a later return counts in the return period, not the delivery period', async () => {
    const today = new Date().toLocaleDateString('sv-SE')
    const order = await deliveredOrder()
    await orderService.pay(order.id, { amount: 190000, method: 'Tiền mặt' })
    await orderService.returnItems(order.id, { lines: [{ productId: 'P-003', quantity: 1 }], reason: 'Hỏng', restock: false, refundMethod: 'Tiền mặt' })
    // Đẩy ngày trả sang hôm sau: kỳ giao hàng phải giữ nguyên doanh thu.
    const stored = db.orders.find((item) => item.id === order.id)
    const tomorrow = new Date(Date.now() + 86_400_000)
    stored.returns[0].at = tomorrow.toISOString()
    const deliveryDay = await reportService.summary({ from: today, to: today })
    assert.equal(deliveryDay.sales.net, 190000)
    assert.equal(deliveryDay.sales.returnsValue, 0)
    const returnDay = tomorrow.toLocaleDateString('sv-SE')
    const later = await reportService.summary({ from: returnDay, to: returnDay })
    assert.equal(later.sales.net, -90000)
    assert.equal(later.sales.returnsValue, 90000)
  })

  await test('period report: bottles and deposit held are balances up to the period end', async () => {
    db.customers = [{ id: 'KH-1', name: 'Khách giữ vỏ', phone: '0901', type: 'Cá nhân', area: 'Q1', addresses: [], legacyOrders: 0 }]
    db.bottleLedger = [
      { id: 'S1', customerId: 'KH-1', at: '2026-09-01T08:00:00+07:00', kind: 'Số dư đầu kỳ', bottles: 3, deposit: 100000 },
      { id: 'S2', customerId: 'KH-1', at: '2026-09-10T08:00:00+07:00', kind: 'Giao kèm đơn', bottles: 2, deposit: 0 },
      { id: 'S3', customerId: 'KH-1', at: '2026-09-20T08:00:00+07:00', kind: 'Thu vỏ', bottles: -4, deposit: 0 },
    ]
    const mid = await reportService.summary({ from: '2026-09-05', to: '2026-09-15' })
    assert.equal(mid.deposits.bottlesOut, 2)
    assert.equal(mid.deposits.held.bottles, 5)
    assert.equal(mid.deposits.held.deposit, 100000)
    // 5 vỏ, cọc đủ cho 2 vỏ (50.000 ₫/vỏ) nên thiếu cọc 3 vỏ.
    assert.equal(mid.deposits.held.uncoveredBottles, 3)
    assert.equal(mid.deposits.held.top[0].name, 'Khách giữ vỏ')
    const end = await reportService.summary({ from: '2026-09-16', to: '2026-09-30' })
    assert.equal(end.deposits.bottlesBack, 4)
    assert.equal(end.deposits.held.bottles, 1)
    assert.equal(end.deposits.held.uncoveredBottles, 0)
  })

  await test('period report: stock movement balances opening + in - out = closing, counting reserved goods', async () => {
    const today = new Date().toLocaleDateString('sv-SE')
    db.receipts = [{ id: 'PN-1', supplierId: 'NCC-1', supplierName: 'NCC', receivedAt: today, receiver: 'Kho', total: 600000, lines: [{ productId: 'P-003', productName: 'Thùng', unit: 'Thùng', received: 12, damaged: 2, costPrice: 60000 }] }]
    db.products.find((product) => product.id === 'P-003').stock += 10
    const order = await deliveredOrder()
    await orderService.returnItems(order.id, { lines: [{ productId: 'P-003', quantity: 1 }], reason: 'Đổi ý', restock: true, refundMethod: 'Tiền mặt' })
    // Đơn đã xác nhận nhưng chưa giao: tồn bán được giảm, hàng vẫn nằm trong kho.
    const open = await orderService.create(draft({ lines: [{ productId: 'P-003', quantity: 3 }] }))
    await orderService.advanceStatus(open.id)
    const row = (await reportService.summary({ from: today, to: today })).inventory.rows.find((item) => item.productId === 'P-003')
    assert.equal(row.received, 10)
    assert.equal(row.damaged, 2)
    assert.equal(row.issued, 2)
    assert.equal(row.restocked, 1)
    assert.equal(row.closing, stock('P-003') + 3)
    assert.equal(row.opening, 30)
    assert.equal(row.opening + row.received + row.restocked - row.issued, row.closing)
  })

  await test('period report: channel and method filters apply to order figures only', async () => {
    const today = new Date().toLocaleDateString('sv-SE')
    db.receipts = [{ id: 'PN-1', supplierId: 'NCC-1', supplierName: 'NCC', receivedAt: today, receiver: 'Kho', total: 600000, lines: [{ productId: 'P-003', productName: 'Thùng', unit: 'Thùng', received: 10, damaged: 0, costPrice: 60000 }] }]
    await deliveredOrder({ channel: 'Điện thoại' })
    await deliveredOrder({ channel: 'Website' })
    const all = await reportService.summary({ from: today, to: today })
    const phone = await reportService.summary({ from: today, to: today }, { channels: ['Điện thoại'] })
    const counter = await reportService.summary({ from: today, to: today }, { method: 'Tại quầy' })
    assert.equal(all.sales.net, 380000)
    assert.equal(phone.sales.net, 190000)
    assert.deepEqual(phone.channels.map((row) => row.channel), ['Điện thoại'])
    assert.equal(counter.sales.delivered, 0)
    // Tồn kho và nhập hàng không đổi theo bộ lọc.
    assert.equal(phone.receipts.count, 1)
    assert.deepEqual(phone.inventory.rows, all.inventory.rows)
  })

  await test('period helpers: previous period has the same length; revenue groups by week and month', async () => {
    assert.deepEqual(previousRange({ from: '2026-10-01', to: '2026-10-31' }), { from: '2026-08-31', to: '2026-09-30' })
    assert.deepEqual(previousRange({ from: '2026-10-20', to: '2026-10-20' }), { from: '2026-10-19', to: '2026-10-19' })
    assert.equal(autoGranularity({ from: '2026-10-01', to: '2026-10-31' }), 'day')
    assert.equal(autoGranularity({ from: '2026-08-01', to: '2026-10-31' }), 'week')
    assert.equal(autoGranularity({ from: '2026-01-01', to: '2026-10-31' }), 'month')
    const days = ['2026-09-30', '2026-10-01', '2026-10-04', '2026-10-05'].map((date, index) => ({ date, revenue: (index + 1) * 1000, collected: 0, orders: 0 }))
    // 30/9 (T4) tới 4/10 (CN) cùng một tuần bắt đầu 28/9; 5/10 là thứ Hai tuần sau.
    assert.deepEqual(groupRevenue(days, 'week').map((bucket) => [bucket.key, bucket.revenue]), [['2026-09-28', 6000], ['2026-10-05', 4000]])
    assert.deepEqual(groupRevenue(days, 'month').map((bucket) => [bucket.label, bucket.revenue]), [['T9/2026', 1000], ['T10/2026', 9000]])
  })

  await test('VietQR payload: EMVCo fields, amount, ASCII note and CRC', async () => {
    const payload = vietQrPayload({ bin: '970436', account: '0071000123456', amount: 185000, note: 'AF-1070' })
    assert.ok(payload.startsWith('000201010212'))
    assert.ok(payload.includes('0006970436011300710001234560208QRIBFTTA'))
    assert.ok(payload.includes('5406185000'))
    assert.ok(payload.includes('0806AF1070'))
    assert.match(payload, /6304[0-9A-F]{4}$/)
    assert.equal(transferNote('Thanh toán đơn AF-1070'), 'Thanh toan don AF1070')
  })

  console.log(`${passed} after-sales scenario groups passed.`)
} finally {
  Object.assign(db, seed)
  delete globalThis.window
  await server.close()
}
