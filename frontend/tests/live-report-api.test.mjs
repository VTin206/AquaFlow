import { test } from 'vitest'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { URL } from 'node:url'

test('live reports use date and channel filters, server pagination and expose permission errors', async () => {
  const requests = []
  const server = createServer((req, res) => {
    requests.push({ method: req.method, url: req.url })
    res.setHeader('Content-Type', 'application/json')
    if (req.url.includes('channel=WEB')) { res.writeHead(403); res.end(JSON.stringify({ status: 403, message: 'Admin only' })); return }
    res.end(JSON.stringify({ sales: { revenue: 123 }, content: [{ productId: 7, revenue: 42 }], totalElements: 80 }))
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const { httpClient } = await import('/src/shared/api/client.ts')
  const previous = httpClient.defaults.baseURL
  httpClient.defaults.baseURL = `http://127.0.0.1:${server.address().port}/api/v1`
  try {
    const { reportApi } = await import('/src/features/reports/reportApi.ts')
    const filter = { from: '2026-01-01', to: '2026-01-31', channel: 'PHONE', method: 'DELIVERY' }
    assert.equal((await reportApi.summary(filter)).sales.revenue, 123)
    const result = await reportApi.section('products', filter, 2, 50)
    assert.equal(result.totalElements, 80)
    const url = new URL(requests[1].url, 'http://localhost')
    assert.equal(url.pathname, '/api/v1/admin/reports/products')
    for (const [key, value] of Object.entries({ ...filter, page: 2, size: 50 })) assert.equal(url.searchParams.get(key), String(value))
    for (const section of ['inventory', 'delivery', 'customers']) await reportApi.section(section, filter)
    await assert.rejects(reportApi.summary({ ...filter, channel: 'WEB' }), error => error.status === 403)
    assert.ok(requests.every(r => r.method === 'GET'))
  } finally {
    httpClient.defaults.baseURL = previous
    await new Promise(resolve => server.close(resolve))
  }
})

test('live Excel labels page scope and keeps amounts numeric and user strings non-executable', async () => {
  const { buildLiveReportWorkbook } = await import('/src/features/reports/exportLiveReport.ts')
  const book = buildLiveReportWorkbook({ generatedAt: '2026-01-03T00:00:00Z' }, { from: '2026-01-01', to: '2026-01-02' },
    'Sản phẩm', [{ key: 'name', title: 'Tên' }, { key: 'revenue', title: 'Doanh thu', money: true }], [{ name: '=1+1', revenue: -100 }], 2)
  const sheet = book.getWorksheet('Báo cáo')
  assert.match(sheet.getCell('A3').value, /Trang 3/)
  assert.equal(sheet.getCell('A6').value, '=1+1')
  assert.equal(sheet.getCell('A6').formula, undefined)
  assert.equal(sheet.getCell('B6').value, -100)
  assert.equal(sheet.getCell('B6').numFmt, '#,##0.00')
  assert.ok((await book.xlsx.writeBuffer()).byteLength > 0)
})
