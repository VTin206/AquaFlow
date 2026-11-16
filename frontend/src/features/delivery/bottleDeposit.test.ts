import { expect, test } from 'vitest'
import { depositShortfall } from './bottleDeposit'

const lines = [
  { bottleTypeId: 1, name: '20L', given: 3, returned: 1, unitDeposit: 50000 },
  { bottleTypeId: 2, name: '10L', given: 2, returned: 2, unitDeposit: 30000 },
]

test('tính cọc cho phần vỏ chưa thu theo từng loại', () => {
  expect(depositShortfall(lines)).toMatchObject({ bottles: 2, total: 100000 })
})

test('trừ số vỏ đang nhập và không âm khi khách trả đủ', () => {
  const result = depositShortfall(lines, { '1': 5 })
  expect(result.bottles).toBe(0)
  expect(result.total).toBe(0)
  expect(depositShortfall(lines, { '1': 1 }).total).toBe(50000)
})
