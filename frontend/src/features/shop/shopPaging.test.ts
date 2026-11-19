import { expect, test } from 'vitest'
import { shopPage } from './shopPaging'

const items = Array.from({ length: 62 }, (_, index) => index + 1)

test('mỗi trang 24 sản phẩm, trang vượt quá thì lùi về trang cuối', () => {
  expect(shopPage(items, null)).toMatchObject({ page: 1, items: items.slice(0, 24) })
  expect(shopPage(items, '3')).toMatchObject({ page: 3, items: items.slice(48) })
  expect(shopPage(items, '9').page).toBe(3)
  expect(shopPage([], '2')).toMatchObject({ page: 1, items: [] })
})
