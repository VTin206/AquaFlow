import { test } from 'vitest'
import assert from 'node:assert/strict'
import { URL } from 'node:url'

const { matchesSearch, normalizeSearch } = await import('/src/shared/utils/search.ts')
const { expiryStatus } = await import('/src/features/inventory/expiry.ts')
const { ordersLink, parseOrderFilters, initialOrderFilters } = await import('/src/features/orders/useOrderFilters.ts')
const { addQuickLine, bestSellers, lastOrderOf, samePhone, shortProductName, toLiveOrderInput } =
  await import('/src/features/orders/orderIntake.ts')

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
test('order intake matches full phone numbers only, across +84 and separators', () => {
  assert.equal(samePhone('0903 456 128', '+84903456128'), true)
  assert.equal(samePhone('090345', '090345'), false)
  assert.equal(samePhone('', ''), false)
  assert.equal(samePhone('0903456128', '0903456129'), false)
})
test('order intake finds the latest order that is not cancelled, by profile or phone', () => {
  const order = (id, at, extra) => ({ id, status: 'Đã giao', phone: '', lines: [], history: [{ at, message: '' }], ...extra })
  const orders = [
    order('old', '2026-01-01T00:00:00Z', { customerId: 'C1' }),
    order('new', '2026-03-01T00:00:00Z', { customerId: 'C1' }),
    order('cancelled', '2026-04-01T00:00:00Z', { customerId: 'C1', status: 'Đã hủy' }),
    order('web', '2026-05-01T00:00:00Z', { phone: '0903456128' }),
    order('other', '2026-06-01T00:00:00Z', { customerId: 'C2', phone: '0911111111' }),
  ]
  assert.equal(lastOrderOf(orders, 'C1', undefined).id, 'new')
  assert.equal(lastOrderOf(orders, undefined, '+84903456128').id, 'web')
  assert.equal(lastOrderOf(orders, undefined, '09'), undefined)
})
test('order intake quick pick raises quantity, fills the empty line, or adds a line', () => {
  assert.deepEqual(addQuickLine([{ quantity: 2 }], 'A'), [{ productId: 'A', quantity: 2 }])
  assert.deepEqual(addQuickLine([{ productId: 'A', quantity: 2 }], 'A'), [{ productId: 'A', quantity: 3 }])
  assert.deepEqual(addQuickLine([{ productId: 'A', quantity: 2 }], 'B'), [
    { productId: 'A', quantity: 2 },
    { productId: 'B', quantity: 1 },
  ])
})
test('order intake shortens product names on quick picks without losing other names', () => {
  assert.equal(shortProductName('Nước tinh khiết Vihawa 20 Lít (Vòi)'), 'Vihawa 20 Lít (Vòi)')
  assert.equal(shortProductName('Nước khoáng LaVie 19 Lít'), 'LaVie 19 Lít')
  assert.equal(shortProductName('Vỏ bình 20L'), 'Vỏ bình 20L')
})
test('order intake ranks best sellers by quantity and ignores cancelled orders', () => {
  const orders = [
    {
      status: 'Đã giao',
      lines: [
        { productId: 'A', quantity: 1 },
        { productId: 'B', quantity: 3 },
      ],
    },
    { status: 'Đã hủy', lines: [{ productId: 'C', quantity: 9 }] },
    { status: 'Đã giao', lines: [{ productId: 'A', quantity: 1 }] },
  ]
  assert.deepEqual(bestSellers(orders), ['B', 'A'])
})
test('order intake builds the live order payload and drops delivery fields for counter orders', () => {
  const base = {
    method: 'Tại quầy',
    channel: 'Tại quầy',
    phone: '0903 456 128',
    customer: ' An ',
    address: 'Cũ',
    area: 'Q1',
    lines: [{ productId: '7', quantity: 2 }],
  }
  const counter = toLiveOrderInput(base, '12')
  assert.equal(counter.customerId, 12)
  assert.equal(counter.fulfillmentType, 'COUNTER')
  assert.equal(counter.recipientName, 'An')
  assert.equal(counter.recipientPhone, '0903456128')
  assert.equal(counter.deliveryAddress, null)
  assert.equal(counter.deliveryArea, null)
  assert.deepEqual(counter.items, [{ productId: 7, quantity: 2 }])
  const delivery = toLiveOrderInput({ ...base, method: 'Giao tận nơi', channel: 'Điện thoại' }, undefined)
  assert.equal(delivery.customerId, null)
  assert.equal(delivery.channel, 'PHONE')
  assert.equal(delivery.deliveryAddress, 'Cũ')
})
test('order links carry filters that survive the URL round trip', () => {
  const params = new URL(ordersLink({ status: 'Chờ xác nhận' }), 'http://local').searchParams
  assert.deepEqual(parseOrderFilters({ status: params.get('status'), payment: params.get('payment') }), {
    ...initialOrderFilters,
    status: 'Chờ xác nhận',
  })
})
