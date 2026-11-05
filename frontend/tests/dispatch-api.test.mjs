import { test } from 'vitest'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'

test('dispatch creates a receipt with POST, reads resources and preserves conflict errors', async () => {
  const receipt = {
    id: 21,
    orderId: 8,
    performedBy: 1,
    dispatchedAt: '2026-11-03T10:00:00Z',
    orderStatus: 'OUT_FOR_DELIVERY',
    items: [{ orderItemId: 9, productId: 12, batchId: 4, lotCode: 'LOT-4', expiresOn: '2027-01-01', quantity: 5 }],
  }
  const requests = []
  let created = false
  const server = createServer(async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    requests.push({ method: req.method, url: req.url, body })
    res.setHeader('Content-Type', 'application/json')
    if (req.method === 'POST') {
      if (created) {
        res.writeHead(409)
        res.end(JSON.stringify({ status: 409, message: 'Đơn đã xuất kho' }))
        return
      }
      created = true
      res.writeHead(201, { Location: '/api/v1/sales/orders/8/dispatches/21' })
      res.end(JSON.stringify(receipt))
      return
    }
    res.end(JSON.stringify(req.url.endsWith('/21') ? receipt : created ? [receipt] : []))
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { httpClient } = await import('/src/shared/api/client.ts')
  const previousUrl = httpClient.defaults.baseURL
  httpClient.defaults.baseURL = `http://127.0.0.1:${server.address().port}/api/v1`
  try {
    const { dispatchApi, canDispatch } = await import('/src/features/live/dispatchApi.ts')
    for (const status of ['PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED']) {
      assert.equal(canDispatch({ status }), status === 'PREPARING')
    }
    assert.deepEqual(await dispatchApi.list(8), [])
    assert.deepEqual(await dispatchApi.create(8), receipt)
    assert.deepEqual(await dispatchApi.list(8), [receipt])
    assert.deepEqual(await dispatchApi.detail(8, 21), receipt)
    await assert.rejects(dispatchApi.create(8), (error) => error.status === 409 && error.message === 'Đơn đã xuất kho')
    assert.deepEqual(
      requests.map(({ method, url }) => [method, url]),
      [
        ['GET', '/api/v1/sales/orders/8/dispatches'],
        ['POST', '/api/v1/sales/orders/8/dispatches'],
        ['GET', '/api/v1/sales/orders/8/dispatches'],
        ['GET', '/api/v1/sales/orders/8/dispatches/21'],
        ['POST', '/api/v1/sales/orders/8/dispatches'],
      ],
    )
    assert.equal(requests[1].body, '', 'Server determines quantities and actor; client sends neither')
  } finally {
    httpClient.defaults.baseURL = previousUrl
    await new Promise((resolve) => server.close(resolve))
  }
})
