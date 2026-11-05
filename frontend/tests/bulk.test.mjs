import { expect, test } from 'vitest'

const { runEach } = await import('/src/shared/utils/bulk.ts')

test('runEach runs items in order, keeps going after a failure and reports each error', async () => {
  const seen = []
  const result = await runEach(['A', 'B', 'C'], async (item) => {
    seen.push(item)
    if (item === 'B') throw new Error('Không đủ hàng')
  })
  expect(seen).toEqual(['A', 'B', 'C'])
  expect(result.done).toEqual(['A', 'C'])
  expect(result.failed).toEqual([{ item: 'B', error: 'Không đủ hàng' }])
})
