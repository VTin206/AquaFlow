import { expect, test } from 'vitest'
import { buildDrinkMenu, drinkMenuHref } from './drinkMenu'
import type { ShopProduct } from './shopService'

const product = (id: string, brand: string, packaging: string, category: string, available: boolean | null = null) =>
  ({ id, name: id, brand, price: 1, unit: 'Bình', available, catalog: { packaging, category, volumeMl: 19000 } }) as unknown as ShopProduct

test('lấy thương hiệu, quy cách và loại nước từ sản phẩm đang bán', () => {
  const menu = buildDrinkMenu([
    product('a', 'LaVie', 'Bình có vòi', 'Nước khoáng'),
    product('b', 'lavie', 'Bình úp máy', 'Nước khoáng'),
    product('c', 'Thương hiệu mới', 'Bình có vòi', 'Nước kiềm'),
    product('d', 'Ngừng bán', 'Thùng lon', 'Nước ngọt', false),
  ])
  expect(menu.map((column) => column.title)).toEqual(['THƯƠNG HIỆU', 'QUY CÁCH', 'LOẠI NƯỚC'])
  expect(menu[0].items.map((item) => item.label)).toEqual(['LaVie', 'Thương hiệu mới'])
  expect(menu[1].items.map((item) => item.filter.group)).toEqual(['jug-tap', 'jug-dispenser'])
  expect(menu[2].items.map((item) => item.label)).toEqual(['Nước khoáng', 'Nước kiềm'])
})

test('chưa có sản phẩm thì không có cột nào; liên kết mang bộ lọc', () => {
  expect(buildDrinkMenu([])).toEqual([])
  expect(drinkMenuHref({ brand: 'LaVie' })).toBe('/shop/drinks?brand=LaVie#products')
})
