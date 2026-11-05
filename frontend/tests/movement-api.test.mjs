import { test } from 'vitest'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { URL } from 'node:url'

test('inventory history uses filtered paginated GET resources and keeps signed quantities', async () => {
  const movement = {
    id: 8,
    type: 'DISPATCH',
    quantity: 3,
    signedQuantity: -3,
    referenceType: 'ORDER',
    referenceId: 4,
    referenceCode: 'AF-4',
    productName: 'Nước',
    unit: 'Bình',
    occurredAt: '2026-11-04T00:00:00Z',
  }
  const requests = []
  const server = createServer((req, res) => {
    requests.push({ method: req.method, url: req.url })
    res.setHeader('Content-Type', 'application/json')
    if (req.url.endsWith('/999')) {
      res.writeHead(404)
      res.end(JSON.stringify({ status: 404, message: 'Không tìm thấy giao dịch kho' }))
      return
    }
    res.end(JSON.stringify(req.url.includes('?') ? { content: [movement], page: 2, size: 20, totalElements: 51 } : movement))
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { httpClient } = await import('/src/shared/api/client.ts')
  const previous = httpClient.defaults.baseURL
  httpClient.defaults.baseURL = `http://127.0.0.1:${server.address().port}/api/v1`
  try {
    const { movementApi } = await import('/src/features/live/movementApi.ts')
    const filter = {
      type: 'DISPATCH',
      productId: 12,
      from: '2026-11-03T17:00:00.000Z',
      to: '2026-11-04T17:00:00.000Z',
      q: 'LOT & %',
      page: 2,
      size: 20,
    }
    const page = await movementApi.list(filter)
    assert.equal(page.totalElements, 51)
    assert.equal(page.content[0].signedQuantity, -3)
    const url = new URL(requests[0].url, 'http://localhost')
    assert.equal(url.pathname, '/api/v1/inventory/movements')
    for (const [key, value] of Object.entries(filter)) assert.equal(url.searchParams.get(key), String(value))
    assert.deepEqual(await movementApi.detail(8), movement)
    assert.deepEqual(requests[1], { method: 'GET', url: '/api/v1/inventory/movements/8' })
    await assert.rejects(movementApi.detail(999), (error) => error.status === 404)
    await movementApi.list({ page: 0, size: 20, type: undefined, q: '' })
    assert.equal(requests.at(-1).url, '/api/v1/inventory/movements?page=0&size=20')
  } finally {
    httpClient.defaults.baseURL = previous
    await new Promise((resolve) => server.close(resolve))
  }
})
