import { brandOf, categoryOf, shopGroups } from './shopGroups'
import type { ShopProduct } from './shopService'

export type DrinkMenuFilter = { brand?: string; group?: string; category?: string }
export type DrinkMenuItem = { label: string; filter: DrinkMenuFilter }
export type DrinkMenuColumn = { title: string; items: DrinkMenuItem[] }

const MAX_ITEMS = 9

/** Mỗi giá trị kèm số sản phẩm, nhiều sản phẩm nhất trước; bằng nhau thì theo tên. */
const ranked = (values: string[]) => {
  const counts = new Map<string, number>()
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1))
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'vi')).map(([value]) => value)
}

/**
 * Menu "Sản phẩm" dựng từ sản phẩm đang bán: thương hiệu, quy cách và loại nước thật sự có hàng,
 * nên thêm thương hiệu hay loại mới thì menu tự có, không phải sửa code.
 */
export function buildDrinkMenu(products: ShopProduct[]): DrinkMenuColumn[] {
  const selling = products.filter((product) => product.available !== false)
  const brands = ranked(selling.map(brandOf).filter((brand) => brand !== 'Khác')).slice(0, MAX_ITEMS)
  const groups = shopGroups.filter((group) => selling.some(group.match))
  const categories = ranked(
    selling.map(categoryOf).filter((category) => !['Khác', 'Chưa phân loại', 'Vỏ bình & phụ kiện'].includes(category)),
  ).slice(0, MAX_ITEMS)
  return [
    { title: 'THƯƠNG HIỆU', items: brands.map((brand) => ({ label: brand, filter: { brand } })) },
    { title: 'QUY CÁCH', items: groups.map((group) => ({ label: group.label, filter: { group: group.key } })) },
    { title: 'LOẠI NƯỚC', items: categories.map((category) => ({ label: category, filter: { category } })) },
  ].filter((column) => column.items.length > 0)
}

export const drinkMenuHref = (filter: DrinkMenuFilter) => `/shop/drinks?${new URLSearchParams(filter).toString()}#products`
