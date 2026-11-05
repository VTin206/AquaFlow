import { test } from 'vitest'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'

test('delivery adapter uses REST resources, passes result/handover data and preserves permission errors', async () => {
  const requests = []
  const server = createServer(async (req, res) => {
    let raw = ''
    for await (const chunk of req) raw += chunk
    const body = raw ? JSON.parse(raw) : undefined
    requests.push({ method: req.method, url: req.url, body })
    res.setHeader('Content-Type', 'application/json')
    if (req.url.includes('/999')) {
      res.writeHead(403)
      res.end(JSON.stringify({ status: 403, message: 'Tài xế chỉ được truy cập chuyến của mình' }))
      return
    }
    res.writeHead(req.method === 'POST' ? 201 : 200)
    res.end(JSON.stringify(req.method === 'GET' ? [] : { id: 7 }))
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { httpClient } = await import('/src/shared/api/client.ts')
  const previousUrl = httpClient.defaults.baseURL
  httpClient.defaults.baseURL = `http://127.0.0.1:${server.address().port}/api/v1`
  try {
    const { deliveryApi } = await import('/src/features/delivery/deliveryApi.ts')
    await deliveryApi.list()
    await deliveryApi.drivers()
    await deliveryApi.available()
    await deliveryApi.create({ driverId: 2, vehicle: '59A' })
    await deliveryApi.assign(7, 3)
    await deliveryApi.add(7, 8, true)
    await deliveryApi.dispatch(7)
    await deliveryApi.remove(7, 8)
    await deliveryApi.depart(7)
    const result = { outcome: 'FAILED', failureReason: 'Khách vắng', note: 'Gọi lại chiều' }
    await deliveryApi.result(7, 8, result)
    await deliveryApi.attempts(7, 8)
    const settlement = { cashReported: 100, cashConfirmed: 90, bottlesExpected: 2, bottlesConfirmed: 2, note: 'Thiếu 10' }
    await deliveryApi.settle(7, settlement)
    await deliveryApi.cancel(7)
    assert.deepEqual(
      requests.map((r) => [r.method, r.url]),
      [
        ['GET', '/api/v1/delivery/trips'],
        ['GET', '/api/v1/delivery/drivers'],
        ['GET', '/api/v1/delivery/available-orders'],
        ['POST', '/api/v1/delivery/trips'],
        ['PUT', '/api/v1/delivery/trips/7/driver'],
        ['POST', '/api/v1/delivery/trips/7/orders'],
        ['POST', '/api/v1/delivery/trips/7/dispatch'],
        ['DELETE', '/api/v1/delivery/trips/7/orders/8'],
        ['PUT', '/api/v1/delivery/trips/7/departure'],
        ['POST', '/api/v1/delivery/trips/7/orders/8/attempts'],
        ['GET', '/api/v1/delivery/trips/7/orders/8/attempts'],
        ['PUT', '/api/v1/delivery/trips/7/settlement'],
        ['PATCH', '/api/v1/delivery/trips/7'],
      ],
    )
    assert.deepEqual(requests[5].body, { orderId: 8, redelivery: true })
    assert.deepEqual(requests[9].body, result)
    assert.deepEqual(requests[11].body, settlement)
    assert.deepEqual(requests[12].body, { status: 'CANCELLED' })
    await assert.rejects(deliveryApi.detail(999), (error) => error.status === 403 && error.message.includes('chuyến của mình'))
  } finally {
    httpClient.defaults.baseURL = previousUrl
    await new Promise((resolve) => server.close(resolve))
  }
})
