import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { setTimeout } from 'node:timers'
import console from 'node:console'

// Load the same TypeScript services as the UI, without an extra test dependency.
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
globalThis.window = { setTimeout: (callback) => setTimeout(callback, 0) }
const { orderService } = await server.ssrLoadModule('/src/features/orders/orderService.ts')
const { db } = await server.ssrLoadModule('/src/mocks/db.ts')
const { amountDue } = await server.ssrLoadModule('/src/features/orders/types.ts')
const seed = globalThis.structuredClone(db)
let passed = 0
const reset = () => {
  Object.assign(db, globalThis.structuredClone(seed))
  // Keep tests independent of the wall-clock date and sample expiration dates.
  db.products.forEach((product) => {
    product.expiry = '31/12/2099'
  })
}
const draft = (overrides = {}) => ({
  customer: 'Khách kiểm thử',
  phone: '0903456128',
  address: '123 Đường A',
  method: 'Giao tận nơi',
  channel: 'Điện thoại',
  deliveryFee: 10000,
  lines: [{ productId: 'P-001', quantity: 2 }],
  ...overrides,
})
const test = async (name, run) => {
  reset()
  await run()
  passed++
  console.log(`PASS ${name}`)
}
try {
  await test('multi-line totals and reservation only at confirmation', async () => {
    const stock = db.products[0].stock
    const order = await orderService.create(
      draft({
        lines: [
          { productId: 'P-001', quantity: 2 },
          { productId: 'P-003', quantity: 1 },
        ],
      }),
    )
    assert.equal(order.total, 240000)
    assert.equal(order.lines.length, 2)
    assert.equal(db.products[0].stock, stock)
    await orderService.advanceStatus(order.id)
    assert.equal(db.products[0].stock, stock - 2)
    assert.equal(db.products[2].stock, seed.products[2].stock - 1)
  })
  await test('aggregate duplicate lines and reject invalid quantities', async () => {
    await assert.rejects(
      orderService.create(
        draft({
          lines: [
            { productId: 'P-001', quantity: 8 },
            { productId: 'P-001', quantity: 8 },
          ],
        }),
      ),
    )
    for (const quantity of [0, -1, 1.5, NaN]) await assert.rejects(orderService.create(draft({ lines: [{ productId: 'P-001', quantity }] })))
    await assert.rejects(orderService.create(draft({ lines: [] })))
    const order = await orderService.create(
      draft({
        lines: [
          { productId: 'P-001', quantity: 1 },
          { productId: 'P-001', quantity: 2 },
        ],
      }),
    )
    assert.equal(order.lines.length, 1)
    assert.equal(order.lines[0].quantity, 3)
  })
  await test('confirmation rechecks all stock before any mutation', async () => {
    const first = await orderService.create(draft({ lines: [{ productId: 'P-001', quantity: 8 }] }))
    const second = await orderService.create(
      draft({
        lines: [
          { productId: 'P-003', quantity: 1 },
          { productId: 'P-001', quantity: 8 },
        ],
      }),
    )
    await orderService.advanceStatus(first.id)
    await assert.rejects(orderService.advanceStatus(second.id))
    assert.equal(db.products[0].stock, 4)
    assert.equal(db.products[2].stock, seed.products[2].stock)
    assert.equal(db.orders.find((order) => order.id === second.id).status, 'Chờ xác nhận')
  })
  await test('confirmation snapshots prices and cancellation releases once', async () => {
    const order = await orderService.create(draft())
    db.products[0].price = 80000
    const confirmed = await orderService.advanceStatus(order.id)
    assert.equal(confirmed.total, 170000)
    db.products[0].price = 100000
    assert.equal(db.orders.find((item) => item.id === order.id).total, 170000)
    await assert.rejects(orderService.cancel(order.id, '  '))
    await orderService.cancel(order.id, 'Khách thay đổi nhu cầu')
    assert.equal(db.products[0].stock, seed.products[0].stock)
    await assert.rejects(orderService.cancel(order.id, 'Lặp lại'))
    await assert.rejects(orderService.advanceStatus(order.id))
    assert.equal(db.products[0].stock, seed.products[0].stock)
  })
  await test('counter guest is allowed for bottles of water sold in cases, not returnable jugs', async () => {
    const order = await orderService.create(
      draft({ customer: '', phone: '', address: '', method: 'Tại quầy', deliveryFee: 10000, lines: [{ productId: 'P-003', quantity: 1 }] }),
    )
    assert.equal(order.customer, 'Khách vãng lai')
    assert.equal(order.deliveryFee, 0)
    await orderService.advanceStatus(order.id)
    await assert.rejects(orderService.advanceStatus(order.id))
    const received = await orderService.receive(order.id, { success: true })
    assert.equal(received.status, 'Đã giao')
    const paid = await orderService.pay(order.id, { amount: received.total, method: 'Tiền mặt' })
    assert.equal(paid.status, 'Đã hoàn tất')
    await assert.rejects(orderService.create(draft({ customer: '', phone: '', method: 'Tại quầy' })))
  })
  await test('required delivery contact, valid phone, future appointment and nonnegative fees', async () => {
    for (const override of [
      { address: ' ' },
      { phone: 'abc' },
      { customer: '' },
      { deliveryFee: -1 },
      { deliveryFee: NaN },
      { appointment: '2000-01-01T10:00' },
    ])
      await assert.rejects(orderService.create(draft(override)))
  })
  await test('expired stock blocked at creation, confirmation and fulfillment', async () => {
    db.products[0].expiry = '01/01/2000'
    await assert.rejects(orderService.create(draft()))
    db.products[0].expiry = '31/12/2099'
    const order = await orderService.create(draft())
    db.products[0].expiry = '01/01/2000'
    await assert.rejects(orderService.advanceStatus(order.id))
    db.products[0].expiry = '31/12/2099'
    await orderService.advanceStatus(order.id)
    await orderService.advanceStatus(order.id)
    db.products[0].expiry = '01/01/2000'
    await assert.rejects(orderService.receive(order.id, { success: true, receiver: 'Khách' }))
  })
  await test('failed delivery requires reason, retry keeps reservation, delivery alone is not completion', async () => {
    const order = await orderService.create(draft())
    await orderService.advanceStatus(order.id)
    await orderService.advanceStatus(order.id)
    await assert.rejects(orderService.receive(order.id, { success: false, reason: ' ' }))
    await assert.rejects(orderService.receive(order.id, { success: true, receiver: ' ' }))
    const failed = await orderService.receive(order.id, { success: false, reason: 'Khách hẹn lại' })
    assert.equal(failed.status, 'Giao thất bại')
    const stock = db.products[0].stock
    await orderService.advanceStatus(order.id)
    assert.equal(db.products[0].stock, stock)
    const received = await orderService.receive(order.id, { success: true, receiver: 'Người nhận hộ' })
    assert.equal(received.status, 'Đã giao')
    assert.match(received.history.at(-1).message, /Người nhận hộ/)
    await assert.rejects(orderService.receive(order.id, { success: true, receiver: 'Khách' }))
  })
  await test('partial receipts, transfer references, overpayment and prepayment completion', async () => {
    const order = await orderService.create(draft())
    await assert.rejects(orderService.pay(order.id, { amount: 1, method: 'Tiền mặt' }))
    await orderService.advanceStatus(order.id)
    await assert.rejects(orderService.pay(order.id, { amount: 0, method: 'Tiền mặt' }))
    await assert.rejects(orderService.pay(order.id, { amount: order.total + 1, method: 'Tiền mặt' }))
    await assert.rejects(orderService.pay(order.id, { amount: 1, method: 'Chuyển khoản', reference: ' ' }))
    let updated = await orderService.pay(order.id, { amount: 50000, method: 'Chuyển khoản', reference: 'BANK-001' })
    assert.equal(amountDue(updated), 100000)
    await assert.rejects(orderService.pay(order.id, { amount: 1, method: 'Chuyển khoản', reference: 'BANK-001' }))
    await assert.rejects(orderService.cancel(order.id, 'Khách hủy'))
    updated = await orderService.pay(order.id, { amount: 100000, method: 'Tiền mặt' })
    assert.equal(updated.status, 'Đang chuẩn bị')
    assert.equal(amountDue(updated), 0)
    await orderService.advanceStatus(order.id)
    updated = await orderService.receive(order.id, { success: true, receiver: 'Khách' })
    assert.equal(updated.status, 'Đã hoàn tất')
    assert.equal(updated.payments.length, 2)
    await assert.rejects(orderService.pay(order.id, { amount: 1, method: 'Tiền mặt' }))
  })
  console.log(`${passed} business scenario groups passed.`)
} finally {
  Object.assign(db, seed)
  delete globalThis.window
  await server.close()
}
