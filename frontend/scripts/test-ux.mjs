import assert from 'node:assert/strict'
import console from 'node:console'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
let passed = 0
function test(name, run) {
  run()
  passed++
  console.log(`PASS ${name}`)
}

try {
  const { matchesSearch, normalizeSearch } = await server.ssrLoadModule('/src/shared/utils/search.ts')
  const { expiryStatus } = await server.ssrLoadModule('/src/features/inventory/expiry.ts')
  const { parseOrderFilters, initialOrderFilters } = await server.ssrLoadModule('/src/features/orders/useOrderFilters.ts')

  test('Vietnamese search handles accents, Đ, combining characters and repeated whitespace', () => {
    assert.equal(normalizeSearch('  ĐẶNG   Nguyễn  '), 'dang nguyen')
    assert.equal(matchesSearch('dang nguyen', 'KH-001 · Đặng Nguyễn · Thủ Đức'), true)
    assert.equal(matchesSearch('THU DUC', 'KH-001 · Đặng Nguyễn · Thủ Đức'), true)
    assert.equal(matchesSearch('nguye\u0302\u0303n', 'Nguyễn'), true)
    assert.equal(matchesSearch('  ', 'Nguyễn'), true)
    assert.equal(matchesSearch('tran', 'Nguyễn'), false)
    assert.equal(matchesSearch('AF-1070', 'AF-1070 Nguyễn Văn An'), true)
  })
  test('phone search ignores spacing and punctuation and recognizes the Vietnam country code', () => {
    for (const query of ['0901234567', '0901 234 567', '0901.234.567', '(0901) 234-567', '+84 901 234 567']) {
      assert.equal(matchesSearch(query, 'Nguyễn Văn An', '0901 234 567'), true, query)
    }
    assert.equal(matchesSearch('0901234567', 'Nguyễn Văn An', '+84 901 234 567'), true)
    assert.equal(matchesSearch('234 567', 'Nguyễn Văn An', '0901234567'), true)
    assert.equal(matchesSearch('0999999999', 'Nguyễn Văn An', '0901234567'), false)
    assert.equal(matchesSearch('An 123', 'Nguyễn Văn An', '0901234567'), false)
    assert.equal(matchesSearch('+ -', 'Nguyễn Văn An', '0901234567'), false)
  })
  test('expired and expiring groups do not overlap at yesterday, today and warning boundaries', () => {
    const today = new Date(2026, 9, 20, 15, 45)
    assert.equal(expiryStatus('19/10/2026', 10, today), 'expired')
    assert.equal(expiryStatus('20/10/2026', 10, today), 'expiring')
    assert.equal(expiryStatus('30/10/2026', 10, today), 'expiring')
    assert.equal(expiryStatus('31/10/2026', 10, today), 'fresh')
    assert.equal(expiryStatus('—', 10, today), 'none')
    assert.equal(expiryStatus('20/10/2026', 0, today), 'expiring')
    assert.equal(expiryStatus('21/10/2026', 0, today), 'fresh')
  })
  test('order filters restore valid selections and recover from corrupt or outdated storage values', () => {
    const saved = { query: 'Nguyễn 0901', status: 'Đang giao', method: 'Giao tận nơi', payment: 'Còn phải thu' }
    assert.deepEqual(parseOrderFilters(JSON.parse(JSON.stringify(saved))), saved)
    for (const value of [null, [], false, 'invalid', 7]) {
      assert.deepEqual(parseOrderFilters(value), initialOrderFilters)
    }
    assert.deepEqual(parseOrderFilters({ query: 15, status: 'OLD', method: {}, payment: 'UNKNOWN' }), initialOrderFilters)
    assert.deepEqual(parseOrderFilters({ query: 'Giữ từ khóa', status: 'OLD' }), { ...initialOrderFilters, query: 'Giữ từ khóa' })
  })
  console.log(`${passed} UX regression scenario groups passed.`)
} finally {
  await server.close()
}
