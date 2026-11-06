import { test } from 'vitest'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { URL } from 'node:url'

test('activity API preserves server pagination and encodes filters; permission errors propagate', async () => {
  const requests = []
  const server = createServer((req, res) => {
    requests.push({ method: req.method, url: req.url })
    res.setHeader('Content-Type', 'application/json')
    if (req.url.endsWith('/999')) {
      res.writeHead(403)
      res.end(JSON.stringify({ message: 'Không có quyền', status: 403 }))
    } else res.end(JSON.stringify(req.url.includes('?') ? { content: [], totalElements: 80, page: 2, size: 20 } : []))
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const { httpClient } = await import('/src/shared/api/client.ts')
  const previous = httpClient.defaults.baseURL
  httpClient.defaults.baseURL = `http://127.0.0.1:${server.address().port}/api/v1`
  try {
    const { activityApi, csvSafeCell, activityDescription } = await import('/src/features/activity/activityApi.ts')
    const filter = { area: 'INVENTORY', actorId: 8, q: 'Nhập & %_', from: '2026-11-03T17:00:00Z', to: '2026-11-04T17:00:00Z', page: 2, size: 20 }
    assert.equal((await activityApi.list(filter)).totalElements, 80)
    const url = new URL(requests[0].url, 'http://localhost')
    for (const [key, value] of Object.entries(filter)) assert.equal(url.searchParams.get(key), String(value))
    await activityApi.actors()
    await activityApi.detail(1)
    await assert.rejects(activityApi.detail(999), error => error.status === 403)
    assert.equal(requests[1].url, '/api/v1/admin/activity-logs/actors')
    assert.equal(requests[2].url, '/api/v1/admin/activity-logs/1')
    assert.ok(requests.every(r => r.method === 'GET'))
    assert.equal(csvSafeCell('=1+1'), "'=1+1")
    assert.equal(csvSafeCell('  @SUM(1)'), "'  @SUM(1)")
    assert.equal(csvSafeCell('Tạo mới'), 'Tạo mới')
    assert.equal(activityDescription({ action: 'UPDATE', reason: null }), 'Cập nhật')
    assert.equal(activityDescription({ action: 'transitionStatus', reason: 'Đổi trạng thái đơn → PREPARING' }), 'Đổi trạng thái đơn → Đang chuẩn bị')
    assert.equal(activityDescription({ action: 'recordResult', reason: 'Ghi kết quả giao hàng · đơn #2 · FAILED' }), 'Ghi kết quả giao hàng · đơn #2 · thất bại')
    assert.equal(activityDescription({ action: 'collect', reason: 'collect' }), 'Thu tiền / nhận vỏ')
    assert.equal(activityDescription({ action: 'someNewMethod', reason: 'someNewMethod' }), 'Thao tác khác')
  } finally {
    httpClient.defaults.baseURL = previous
    await new Promise(resolve => server.close(resolve))
  }
})
