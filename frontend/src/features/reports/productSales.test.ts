import { expect, test } from 'vitest'
import { productShares, rankProducts, type ProductSale } from './productSales'

const sale = (productId: string, quantity: number, revenue: number): ProductSale => ({
  productId,
  name: `SP ${productId}`,
  unit: 'bình',
  quantity,
  revenue,
})

test('ranks by the chosen metric and drops products without sales', () => {
  const rows = [sale('a', 50, 1_000_000), sale('b', 10, 3_000_000), sale('c', 0, 0), sale('d', -2, -40_000)]
  expect(rankProducts(rows, 'quantity').map((row) => row.productId)).toEqual(['a', 'b'])
  expect(rankProducts(rows, 'revenue').map((row) => row.productId)).toEqual(['b', 'a'])
  expect(rankProducts(rows, 'quantity', 1).map((row) => row.productId)).toEqual(['a'])
})

test('folds the tail into one "other" slice and the shares add up to one', () => {
  const rows = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id, index) => sale(id, 70 - index * 10, 0))
  const shares = productShares(rows, 'quantity', 5)
  expect(shares.map((slice) => slice.key)).toEqual(['a', 'b', 'c', 'd', 'e', 'other'])
  expect(shares.at(-1)).toMatchObject({ value: 30, name: 'Khác (2 sản phẩm)', other: true })
  expect(shares.reduce((sum, slice) => sum + slice.share, 0)).toBeCloseTo(1)
})

test('keeps a lone sixth product instead of an "other" slice of one', () => {
  const rows = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => sale(id, 5, 0))
  expect(productShares(rows, 'quantity', 5).some((slice) => slice.other)).toBe(false)
  expect(productShares([sale('a', 0, 0)], 'quantity')).toEqual([])
})
