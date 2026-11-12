import { describe, expect, it } from 'vitest'
import { emptyFilters, filterProducts } from './shopGroups'
import type { ShopProduct } from './shopService'

const product = (id: string, available: boolean | null = null): ShopProduct => ({
  id,
  sku: `SP${id}`,
  name: `Nước ${id}`,
  brand: 'Aqua',
  unit: 'Bình',
  price: 20000,
  available,
})

const ids = (items: ShopProduct[]) => items.map((item) => item.id)

describe('filterProducts', () => {
  const products = [product('1'), product('2'), product('3'), product('4'), product('5')]

  it('puts best sellers first in rank order and keeps the rest in their original order', () => {
    expect(ids(filterProducts(products, emptyFilters, ['4', '2']))).toEqual(['4', '2', '1', '3', '5'])
  })

  it('keeps the original order when there are no best sellers', () => {
    expect(ids(filterProducts(products, emptyFilters))).toEqual(['1', '2', '3', '4', '5'])
  })

  it('still lists unavailable products last, even when they are best sellers', () => {
    const withSoldOut = [product('1'), product('2', false), product('3'), product('4', true)]
    expect(ids(filterProducts(withSoldOut, emptyFilters, ['2', '3']))).toEqual(['3', '1', '4', '2'])
  })

  it('applies filters before ranking', () => {
    const filtered = filterProducts([...products, { ...product('6'), name: 'Soda 6' }], { ...emptyFilters, query: 'soda' }, ['4', '6'])
    expect(ids(filtered)).toEqual(['6'])
  })
})
