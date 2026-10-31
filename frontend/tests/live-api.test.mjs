import { afterAll, test } from 'vitest'
import assert from 'node:assert/strict'
import { createServer as createHttpServer } from 'node:http'
import { QueryClient } from '@tanstack/react-query'

// HTTP fixtures theo controller/DTO hiện có. Đây là contract FE, không thay cho test BE/PostgreSQL.
const product = { id: 12, sku: '0012', name: 'Nước thử', brand: null, unit: 'Bình', unitsPerCase: null, bottleTypeId: 1, bottleTypeName: 'Vỏ 20L', salePrice: 70000, active: true, createdAt: '2026-10-22T00:00:00Z' }
const supplier = { id: 4, name: 'Nhà cung cấp thử', phone: null, address: null, active: true }
const customer = { id: 3, fullName: 'Khách thử', phone: '0901234567', createdAt: '2026-10-22T00:00:00Z' }
const address = { id: 5, customerId: 3, recipientName: 'Người nhận', recipientPhone: '0901234568', addressLine: '15 Đường B', area: null, isDefault: true }
const order = { id: 8, orderCode: 'DH-008', customerId: null, createdBy: 1, channel: 'PHONE', fulfillmentType: 'DELIVERY', status: 'CONFIRMED', paymentStatus: 'PARTIALLY_PAID', recipientName: 'Khách thử', recipientPhone: '0901234567', deliveryAddress: '12 Đường A', deliveryArea: null, requestedDeliveryAt: null, subtotal: 140000, discountAmount: 10000, deliveryFee: 20000, total: 150000, createdAt: '2026-10-22T00:00:00Z', confirmedAt: null, cancelledAt: null, note: null, items: [{ id: 9, productId: 12, quantity: 2, unitPrice: 70000, lineTotal: 140000 }] }
const guestOrder = { ...order, id: 10, orderCode: 'WEB-010', channel: 'WEB', status: 'PENDING', paymentStatus: 'UNPAID', customerId: null, createdBy: null, confirmedAt: null }
const routes = new Map([
  ['/api/v1/products?active=true', [product]], ['/api/v1/products/12', product],
  ['/api/v1/suppliers?active=true', [supplier]], ['/api/v1/sales/orders', [order]], ['/api/v1/sales/orders/8', order],
  ['/api/v1/customer/orders/guest', guestOrder],
  ['/api/v1/sales/customers', [customer]], ['/api/v1/sales/customers/3/addresses', [address]],
])
const requests = []
let bottleType = { id: 7, name: 'Vỏ thử 20L', depositUnitAmount: 50000, active: true }
const http = createHttpServer(async (request, response) => {
  let rawBody = ''
  for await (const chunk of request) rawBody += chunk
  const body = rawBody ? JSON.parse(rawBody) : undefined
  const requestRecord = { method: request.method, url: request.url, body }
  requests.push(requestRecord)
  response.setHeader('Content-Type', 'application/json')
  if (request.url === '/api/v1/customer/orders/guest' && body?.recipientName === 'Lỗi kiểm tra') {
    requestRecord.responseStatus = 400
    response.writeHead(400)
    response.end(JSON.stringify({ status: 400, error: 'Bad Request', message: 'Số điện thoại không hợp lệ.' }))
    return
  }
  if (request.url.startsWith('/api/v1/bottle-types')) {
    if (request.method === 'POST') {
      if (body.name === 'Trùng tên') {
        response.writeHead(409)
        response.end(JSON.stringify({ status: 409, message: 'Bottle type already exists' }))
        return
      }
      bottleType = { ...bottleType, ...body }
      response.writeHead(201)
    } else if (request.method === 'PUT') {
      bottleType = { ...bottleType, depositUnitAmount: body.depositUnitAmount }
    } else if (request.method === 'DELETE') {
      bottleType.active = false
      response.writeHead(204)
      response.end()
      return
    }
    response.end(JSON.stringify(request.method === 'GET' ? [bottleType] : bottleType))
    return
  }
  const status = request.url === '/api/v1/sales/orders/403' ? 403 : routes.has(request.url) ? request.method === 'POST' && request.url === '/api/v1/customer/orders/guest' ? 201 : 200 : 404
  requestRecord.responseStatus = status
  response.writeHead(status)
  response.end(JSON.stringify(status >= 200 && status < 300 ? routes.get(request.url) : { status, error: 'Error', message: status === 403 ? 'Không có quyền xem đơn.' : 'Không tìm thấy dữ liệu.' }))
})

test('live API adapters match the backend contract and never fall back to demo data', async () => {
  await new Promise((resolve) => http.listen(0, '127.0.0.1', resolve))
  const { httpClient, ApiError } = await import('/src/shared/api/client.ts')
  httpClient.defaults.baseURL = `http://127.0.0.1:${http.address().port}/api/v1`
  const { catalogApi } = await import('/src/features/live/catalogApi.ts')
  const { guestOrderApi } = await import('/src/features/live/guestOrderApi.ts')
  const { customerApi } = await import('/src/features/live/customerApi.ts')
  const { canCancel, canPrepare, orderApi, orderStatusLabels, paymentStatusLabels } = await import('/src/features/live/orderApi.ts')
  const { toGuestOrderInput, toShopProduct } = await import('/src/features/shop/shopService.ts')

  assert.deepEqual(await catalogApi.products(), [product])
  assert.deepEqual(await catalogApi.product('12'), product)
  assert.deepEqual(await catalogApi.suppliers(), [supplier])
  assert.deepEqual(await customerApi.list(), [customer])
  assert.deepEqual(await customerApi.addresses(3), [address])
  const shop = toShopProduct(product)
  assert.equal(shop.id, '12')
  assert.equal(shop.sku, '0012')
  assert.equal(shop.price, 70000)
  assert.equal(shop.available, null, 'Active catalog product does not prove stock availability')
  assert.equal('stock' in shop, false)
  assert.equal(shop.brand, '')
  assert.equal(toShopProduct({ ...product, active: false }).available, false)
  // catalog list/detail/suppliers use existing HTTP endpoints; SKU and price map correctly; stock stays unknown

  assert.deepEqual(await orderApi.list(), [order])
  assert.deepEqual(await orderApi.detail(8), order)
  assert.equal(orderStatusLabels.CONFIRMED, 'Đã xác nhận')
  assert.equal(paymentStatusLabels.REFUND_PENDING, 'Chờ hoàn tiền')
  assert.equal(paymentStatusLabels.PARTIALLY_PAID, 'Thanh toán một phần')
  for (const status of ['PENDING', 'CONFIRMED', 'PREPARING']) assert.equal(canCancel({ status }), true)
  for (const status of ['OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED']) assert.equal(canCancel({ status }), false)
  for (const status of Object.keys(orderStatusLabels)) assert.equal(canPrepare({ status }), status === 'CONFIRMED')
  // order list/detail preserve backend status, item prices, discount and total
  // live cancel and prepare actions match backend policy; cancel stays unavailable after dispatch

  const { inferCatalog } = await import('/src/features/inventory/catalogGroups.ts')
  const { shopGroups } = await import('/src/features/shop/shopGroups.ts')
  const groupOf = (name, unit) => shopGroups.find((group) => group.match({ name, unit, catalog: inferCatalog(name, unit) }))?.key
  assert.deepEqual(inferCatalog('Nước khoáng Vĩnh Hảo 20 Lít (Vòi)', 'Bình'), { category: 'Nước khoáng', packaging: 'Bình có vòi', capacity: '18,5–20L', volumeMl: 20000 })
  assert.equal(inferCatalog('Nước khoáng Vĩnh Hảo có gas 500ml', 'Thùng').category, 'Nước có ga')
  assert.equal(inferCatalog('Nước Revive muối khoáng 390ml', 'Thùng').category, 'Bù khoáng & điện giải')
  assert.equal(inferCatalog('Nước kiềm ion Life 1.25 Lít', 'Thùng').volumeMl, 1250)
  assert.equal(groupOf('Nước LaVie kiềm 19 Lít (úp)', 'Bình'), 'jug-dispenser')
  assert.equal(groupOf('Nước tinh khiết Aquafina 1,5 Lít', 'Thùng'), 'large')
  assert.equal(groupOf('Nước khoáng Lavie 5 Lít', 'Thùng'), 'can-5l')
  assert.equal(groupOf('Thức uống bổ sung ion Pocari Sweat Lon 330ml', 'Thùng'), 'tin')
  assert.equal(groupOf('Nước Rosée chai 330ml (24 chai)', 'Lốc'), 'small-350')
  assert.equal(inferCatalog('Vỏ bình 20L', 'Vỏ').packaging, 'Vỏ bình')
  // live shop infers water type, packaging and size from product names so storefront filters work without catalog data

  const guestInput = toGuestOrderInput({ customer: 'Nguyen Van An', phone: '0901234567', address: '123 Nguyen Trai', area: 'Quan 5', lines: [{ productId: '12', quantity: 2 }], note: 'Giao buổi sáng', floor: 4, appointment: '2026-10-29T08:00:00Z' })
  const createdGuestOrder = await guestOrderApi.create(guestInput)
  assert.equal(createdGuestOrder.status, 'PENDING')
  assert.equal(createdGuestOrder.orderCode, 'WEB-010')
  assert.deepEqual(requests.at(-1), { method: 'POST', url: '/api/v1/customer/orders/guest', body: guestInput, responseStatus: 201 })
  assert.equal('customerId' in requests.at(-1).body, false)
  assert.equal('unitPrice' in requests.at(-1).body.items[0], false)
  await assert.rejects(guestOrderApi.create({ ...guestInput, recipientName: 'Lỗi kiểm tra' }), (error) => error instanceof ApiError && error.status === 400 && error.message === 'Số điện thoại không hợp lệ.')
  // guest checkout uses public endpoint, sends contact/items only, preserves PENDING response and server-side price contract

  await assert.rejects(catalogApi.product('999'), (error) => error instanceof ApiError && error.status === 404)
  await assert.rejects(orderApi.detail(403), (error) => error instanceof ApiError && error.status === 403 && error.message === 'Không có quyền xem đơn.')
  assert.ok(requests.filter((request) => request.url !== '/api/v1/customer/orders/guest').every((request) => request.method === 'GET'), 'Other live adapters do not issue unsupported writes')
  // HTTP errors propagate without falling back to demo data; guest errors remain visible to checkout

  const { bottleTypeApi } = await import('/src/features/live/bottleTypeApi.ts')
  await bottleTypeApi.list(true)
  await bottleTypeApi.list(false)
  await bottleTypeApi.list()
  assert.deepEqual(requests.slice(-3).map((request) => request.url), ['/api/v1/bottle-types?active=true', '/api/v1/bottle-types?active=false', '/api/v1/bottle-types'])
  const created = await bottleTypeApi.create({ name: '  Vỏ mới  ', depositUnitAmount: 100000 })
  assert.equal(created.name, 'Vỏ mới')
  assert.deepEqual(requests.at(-1).body, { name: 'Vỏ mới', depositUnitAmount: 100000 })
  const updated = await bottleTypeApi.update(7, 120000)
  assert.equal(updated.depositUnitAmount, 120000)
  assert.deepEqual(requests.at(-1), { method: 'PUT', url: '/api/v1/bottle-types/7', body: { depositUnitAmount: 120000 } }, 'Update sends only the editable deposit, not name/active')
  await assert.rejects(bottleTypeApi.create({ name: 'Trùng tên', depositUnitAmount: 0 }), (error) => error instanceof ApiError && error.status === 409)
  await bottleTypeApi.deactivate(7)
  assert.equal((await bottleTypeApi.list(false))[0].active, false)
  // bottle CRUD contract: trimmed create, deposit-only update, inactive filter, conflict and HTTP 204

  const { invalidateLiveData } = await import('/src/features/live/invalidateLiveData.ts')
  const client = new QueryClient()
  const liveKeys = [['live', 'catalog'], ['live', 'receipt-suppliers', 'Admin', 'ADMIN'], ['live', 'order-customers'], ['live', 'order-addresses', 3], ['shop', 'products', 'live'], ['shop', 'product', 'live', '12']]
  const demoKey = ['shop', 'products', 'demo']
  for (const key of [...liveKeys, demoKey]) client.setQueryData(key, [])
  await invalidateLiveData(client)
  for (const key of liveKeys) assert.equal(client.getQueryState(key).isInvalidated, true)
  assert.equal(client.getQueryState(demoKey).isInvalidated, false, 'Live edits must not invalidate demo data')
  client.clear()
  // edits refresh catalogs, form choices and live shop/detail caches while preserving demo
})

afterAll(async () => {
await new Promise((resolve) => http.close(resolve))
})
