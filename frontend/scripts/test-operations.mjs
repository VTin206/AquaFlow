import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { setTimeout } from 'node:timers'
import console from 'node:console'

// Kiểm thử quy tắc nghiệp vụ hồ sơ khách, sổ vỏ/cọc, phiếu nhập theo lô và chuyến giao
// trên cùng service mock mà giao diện đang dùng.
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
globalThis.window = { setTimeout: (callback) => setTimeout(callback, 0) }
const load = (path) => server.ssrLoadModule(path)
const { db } = await load('/src/mocks/db.ts')
const { orderService } = await load('/src/features/orders/orderService.ts')
const { customerService } = await load('/src/features/customers/customerService.ts')
const { productService } = await load('/src/features/inventory/productService.ts')
const { tripService } = await load('/src/features/delivery/tripService.ts')
const { DEPOSIT_PER_BOTTLE, PICKUP_FEE, suggestedDeliveryFee, stairsSurcharge } = await load('/src/shared/policy.ts')

const original = globalThis.structuredClone(db)
const seed = {
  ...globalThis.structuredClone(db),
  products: [
    { id: 'P-001', name: 'Bình kiểm thử 20L', brand: 'Kiểm thử', unit: 'Bình', stock: 30, threshold: 5, price: 70000, expiry: '31/12/2099', sku: 'TEST-20L' },
    { id: 'P-002', name: 'Vỏ bình kiểm thử', brand: 'Kiểm thử', unit: 'Vỏ', stock: 10, threshold: 5, price: 50000, expiry: '—', sku: 'TEST-VO' },
    { id: 'P-003', name: 'Thùng kiểm thử', brand: 'Kiểm thử', unit: 'Thùng', stock: 40, threshold: 5, price: 90000, expiry: '31/12/2099', sku: 'TEST-500' },
  ],
  orders: [],
  customers: [],
  bottleLedger: [],
  lots: [],
  receipts: [],
  trips: [],
}
let passed = 0
const test = async (name, run) => {
  Object.assign(db, globalThis.structuredClone(seed))
  await run()
  passed++
  console.log(`PASS ${name}`)
}
const delivery = (overrides = {}) => ({
  customer: 'Quán kiểm thử',
  phone: '0903 000 111',
  address: '1 Đường A, Quận 1',
  method: 'Giao tận nơi',
  channel: 'Điện thoại',
  deliveryFee: 0,
  lines: [{ productId: 'P-001', quantity: 2 }],
  ...overrides,
})
/** Tạo đơn, xác nhận và đưa đến trạng thái đang giao. */
const dispatched = async (overrides) => {
  const order = await orderService.create(delivery(overrides))
  await orderService.advanceStatus(order.id)
  await orderService.advanceStatus(order.id)
  return order
}
const localDate = (now) => {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
const future = (days, now = new Date()) => {
  const date = new Date(now)
  date.setDate(date.getDate() + days)
  return localDate(date)
}
const today = () => localDate(new Date())

try {
  assert.equal(future(1, new Date(2026, 9, 23, 0, 15)), '2026-10-24', 'Tomorrow stays tomorrow after local midnight')
  await test('customer profiles: unique phone, edit, auto-link from orders', async () => {
    const created = await customerService.create({ name: 'Nguyễn Kiểm Thử', phone: '0911 222 333', type: 'Cá nhân', area: 'Quận 3', addresses: ['5 Đường B', ' ', '5 Đường B'] })
    assert.equal(created.id, 'KH-001')
    assert.deepEqual(created.addresses, ['5 Đường B'])
    await assert.rejects(customerService.create({ name: 'Trùng', phone: '0911222333', type: 'Cá nhân', addresses: [] }), /đã thuộc khách/)
    await assert.rejects(customerService.create({ name: ' ', phone: '0911000000', type: 'Cá nhân', addresses: [] }))
    await assert.rejects(customerService.create({ name: 'Sai số', phone: '123', type: 'Cá nhân', addresses: [] }))
    const updated = await customerService.update(created.id, { name: 'Nguyễn Kiểm Thử', phone: '0911222333', type: 'Doanh nghiệp', area: 'Quận 3', addresses: ['7 Đường C'] })
    assert.equal(updated.type, 'Doanh nghiệp')

    const order = await orderService.create(delivery({ customer: 'Nguyễn Kiểm Thử', phone: '0911 222 333', address: '9 Đường D' }))
    assert.equal(order.customerId, created.id)
    assert.ok(db.customers[0].addresses.includes('9 Đường D'))
    const guest = await orderService.create(delivery({ customer: 'Khách mới', phone: '0988 777 666' }))
    assert.equal(db.customers.length, 2)
    assert.equal(guest.customerId, db.customers[0].id)
    const counter = await orderService.create({ method: 'Tại quầy', channel: 'Tại quầy', deliveryFee: 0, lines: [{ productId: 'P-003', quantity: 1 }] })
    assert.equal(counter.customerId, undefined)
  })

  await test('bottle ledger on delivery: delivered, returned, deposit kept out of order total', async () => {
    const order = await dispatched()
    await assert.rejects(orderService.receive(order.id, { success: true, receiver: 'Chủ quán', bottlesReturned: 3 }), /chỉ có 2 vỏ/)
    await assert.rejects(orderService.receive(order.id, { success: true, receiver: 'Chủ quán', bottlesReturned: -1 }))
    const received = await orderService.receive(order.id, { success: true, receiver: 'Chủ quán', bottlesReturned: 1, depositCollected: DEPOSIT_PER_BOTTLE })
    assert.deepEqual(received.bottles, { delivered: 2, returned: 1, deposit: DEPOSIT_PER_BOTTLE })
    assert.equal(received.total, 140000)
    const [customer] = await customerService.list()
    assert.equal(customer.bottlesHeld, 1)
    assert.equal(customer.depositHeld, DEPOSIT_PER_BOTTLE)
    assert.equal(customer.debt, 140000)
    const ledger = await customerService.ledger(customer.id)
    assert.deepEqual(ledger.map((entry) => entry.kind).sort(), ['Giao kèm đơn', 'Thu cọc', 'Thu vỏ'])
    assert.ok(ledger.every((entry) => entry.orderId === order.id))
  })

  await test('bottle actions: return limits, refund only for returned bottles, loss forfeits deposit', async () => {
    const order = await dispatched({ lines: [{ productId: 'P-001', quantity: 3 }] })
    await orderService.receive(order.id, { success: true, receiver: 'Chủ quán', bottlesReturned: 0, depositCollected: 3 * DEPOSIT_PER_BOTTLE })
    const id = order.customerId
    await assert.rejects(customerService.recordBottles(id, { kind: 'Hoàn cọc', deposit: 1 }), /Thu vỏ trước/)
    await assert.rejects(customerService.recordBottles(id, { kind: 'Thu vỏ', bottles: 4 }), /chỉ đang giữ 3/)
    let customer = await customerService.recordBottles(id, { kind: 'Thu vỏ', bottles: 1 })
    assert.equal(customer.bottlesHeld, 2)
    await assert.rejects(customerService.recordBottles(id, { kind: 'Hoàn cọc', deposit: DEPOSIT_PER_BOTTLE + 1 }))
    customer = await customerService.recordBottles(id, { kind: 'Hoàn cọc', deposit: DEPOSIT_PER_BOTTLE })
    assert.equal(customer.depositHeld, 2 * DEPOSIT_PER_BOTTLE)
    await assert.rejects(customerService.recordBottles(id, { kind: 'Báo mất/vỡ', bottles: 1 }), /tình huống/)
    customer = await customerService.recordBottles(id, { kind: 'Báo mất/vỡ', bottles: 1, note: 'Vỏ nứt' })
    assert.equal(customer.bottlesHeld, 1)
    assert.equal(customer.depositHeld, DEPOSIT_PER_BOTTLE)
    await assert.rejects(customerService.recordBottles(id, { kind: 'Thu cọc', deposit: 0 }))
  })

  await test('receipts: validate every line first, damaged and expired goods never become sellable', async () => {
    const base = { supplierId: 'NCC-001', receivedAt: today(), receiver: 'Thủ kho' }
    const good = { productId: 'P-001', lotCode: 'L-01', mfgDate: today(), expiryDate: future(200), received: 10, damaged: 2, costPrice: 40000 }
    await assert.rejects(productService.createReceipt({ ...base, lines: [good, { ...good, productId: 'P-003', lotCode: 'L-X', expiryDate: today() }] }), /hết hạn/)
    assert.equal(db.products[0].stock, 30)
    assert.equal(db.lots.length, 0)
    await assert.rejects(productService.createReceipt({ ...base, lines: [{ ...good, lotCode: '' }] }), /mã lô/)
    await assert.rejects(productService.createReceipt({ ...base, lines: [{ ...good, damaged: 11 }] }))
    await assert.rejects(productService.createReceipt({ ...base, receivedAt: future(1), lines: [good] }))
    await assert.rejects(productService.createReceipt({ ...base, supplierId: 'NCC-404', lines: [good] }))
    const receipt = await productService.createReceipt({ ...base, lines: [good, { productId: 'P-002', received: 5, damaged: 0, costPrice: 50000 }] })
    assert.equal(receipt.total, 8 * 40000 + 5 * 50000)
    assert.equal(db.products[0].stock, 38)
    assert.equal(db.products[1].stock, 15)
    await assert.rejects(productService.createReceipt({ ...base, lines: [good] }), /đã được nhập/)
  })

  await test('lots follow FEFO and product expiry tracks the earliest remaining lot', async () => {
    db.products[0].stock = 0
    const base = { supplierId: 'NCC-001', receivedAt: today(), receiver: 'Thủ kho' }
    await productService.createReceipt({
      ...base,
      lines: [
        { productId: 'P-001', lotCode: 'LATE', expiryDate: future(300), received: 5, damaged: 0, costPrice: 1 },
        { productId: 'P-001', lotCode: 'EARLY', expiryDate: future(100), received: 4, damaged: 0, costPrice: 1 },
      ],
    })
    const order = await orderService.create(delivery({ lines: [{ productId: 'P-001', quantity: 6 }] }))
    await orderService.advanceStatus(order.id)
    const lots = (await productService.lots()).filter((lot) => lot.productId === 'P-001')
    assert.deepEqual(lots.map((lot) => [lot.lotCode, lot.remaining]), [['EARLY', 0], ['LATE', 3]])
    const [product] = await productService.list()
    assert.equal(product.expiry, future(300).split('-').reverse().join('/'))
  })

  await test('trips: one active trip per order, atomic departure, settlement needs results and notes', async () => {
    const first = await orderService.create(delivery())
    const second = await orderService.create(delivery({ phone: '0903 000 222', customer: 'Khách 2' }))
    await assert.rejects(tripService.create({ driver: 'Trần Văn Tài', orderIds: [first.id] }), /không ở trạng thái chờ giao/)
    await orderService.advanceStatus(first.id)
    await orderService.advanceStatus(second.id)
    await assert.rejects(tripService.create({ driver: 'Ai đó', orderIds: [first.id] }), /tài xế/)
    const trip = await tripService.create({ driver: 'Trần Văn Tài', orderIds: [first.id, second.id] })
    await assert.rejects(tripService.create({ driver: 'Lê Minh Quân', orderIds: [first.id] }), /đã nằm trong chuyến/)

    await orderService.cancel(second.id, 'Khách hủy')
    await assert.rejects(tripService.depart(trip.id), /AF-/)
    assert.equal(db.orders.find((order) => order.id === first.id).status, 'Đang chuẩn bị')
    await tripService.removeOrder(trip.id, second.id)
    const departed = await tripService.depart(trip.id)
    assert.equal(departed.status, 'Đang giao')
    await assert.rejects(tripService.cancel(trip.id))
    await assert.rejects(tripService.settle(trip.id, { cashHandedOver: 0, bottlesHandedOver: 0 }), /kết quả giao/)

    await orderService.pay(first.id, { amount: 100000, method: 'Tiền mặt' })
    await orderService.receive(first.id, { success: true, receiver: 'Chủ quán', bottlesReturned: 2 })
    assert.equal((await tripService.list())[0].status, 'Chờ đối soát')
    await assert.rejects(tripService.settle(trip.id, { cashHandedOver: 90000, bottlesHandedOver: 2 }), /chênh lệch/)
    const settled = await tripService.settle(trip.id, { cashHandedOver: 100000, bottlesHandedOver: 2 })
    assert.deepEqual([settled.status, settled.settlement.cashExpected, settled.settlement.bottlesExpected], ['Đã đối soát', 100000, 2])
  })

  await test('failed stop returns to the queue only after its trip is settled', async () => {
    const order = await orderService.create(delivery())
    await orderService.advanceStatus(order.id)
    const trip = await tripService.create({ driver: 'Phạm Đức Huy', orderIds: [order.id] })
    await tripService.depart(trip.id)
    await orderService.receive(order.id, { success: false, reason: 'Khách vắng nhà' })
    await assert.rejects(tripService.create({ driver: 'Lê Minh Quân', orderIds: [order.id] }), /đã nằm trong chuyến/)
    await tripService.settle(trip.id, { cashHandedOver: 0, bottlesHandedOver: 0 })
    const retry = await tripService.create({ driver: 'Lê Minh Quân', orderIds: [order.id] })
    await tripService.depart(retry.id)
    assert.match(db.orders[0].history.at(-1).message, /lần giao lại/)
  })

  await test('iWater-style policy: delivery fee, stairs surcharge, pickup fee taken from deposit', async () => {
    assert.equal(suggestedDeliveryFee({ units: 3, jugs: 3, floor: 0 }), 0)
    assert.equal(suggestedDeliveryFee({ units: 2, jugs: 2, floor: 0 }), 15000)
    assert.deepEqual([1, 2, 3, 4].map((floor) => stairsSurcharge(floor, 2)), [4000, 8000, 16000, 24000])
    assert.equal(suggestedDeliveryFee({ units: 4, jugs: 4, floor: 3 }), 32000)
    await assert.rejects(orderService.create(delivery({ floor: -1 })))
    assert.equal((await orderService.create(delivery({ floor: 2 }))).floor, 2)

    const order = await dispatched({ lines: [{ productId: 'P-001', quantity: 2 }] })
    await orderService.receive(order.id, { success: true, receiver: 'Chủ quán', bottlesReturned: 0, depositCollected: 2 * DEPOSIT_PER_BOTTLE })
    let customer = await customerService.recordBottles(order.customerId, { kind: 'Thu vỏ', bottles: 2, pickup: true })
    assert.equal(customer.bottlesHeld, 0)
    assert.equal(customer.depositHeld, 2 * DEPOSIT_PER_BOTTLE - PICKUP_FEE)
    customer = await customerService.recordBottles(order.customerId, { kind: 'Hoàn cọc', deposit: customer.depositHeld })
    assert.equal(customer.depositHeld, 0)
  })

  console.log(`${passed} business scenario groups passed.`)
} finally {
  Object.assign(db, original)
  delete globalThis.window
  await server.close()
}
