import { test } from 'vitest'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'

test('return inspection sends per-load quantities and exposes duplicate conflicts', async () => {
  const requests = []
  const server = createServer(async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    requests.push({ method: req.method, url: req.url, body: body ? JSON.parse(body) : null })
    res.setHeader('Content-Type', 'application/json')
    if (req.method === 'POST' && requests.filter(r => r.method === 'POST').length > 1) {
      res.writeHead(409)
      res.end(JSON.stringify({ status: 409, message: 'Đơn không còn chờ hoàn hàng' }))
    } else res.end(JSON.stringify(req.method === 'POST' ? { id: 7 } : []))
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const { httpClient } = await import('/src/shared/api/client.ts')
  const previous = httpClient.defaults.baseURL
  httpClient.defaults.baseURL = `http://127.0.0.1:${server.address().port}/api/v1`
  try {
    const { returnApi } = await import('/src/features/live/returnApi.ts')
    await returnApi.pending()
    const input = { orderId: 4, lines: [{ loadItemId: 10, sellable: 0 }], note: 'Bình hỏng' }
    assert.equal((await returnApi.create(input)).id, 7)
    assert.deepEqual(requests[1].body, input)
    await assert.rejects(returnApi.create(input), error => error.status === 409)
    await returnApi.list(2)
    await returnApi.detail(7)
    assert.equal(requests[0].url, '/api/v1/inventory/returns/pending')
    assert.equal(requests[3].url, '/api/v1/inventory/returns?page=2&size=20')
    assert.equal(requests[4].url, '/api/v1/inventory/returns/7')
  } finally {
    httpClient.defaults.baseURL = previous
    await new Promise(resolve => server.close(resolve))
  }
})
