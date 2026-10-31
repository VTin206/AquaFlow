import { getBrandGroup, normalizeSearch } from '@/features/inventory/catalog'
import type { ShopProduct } from './shopService'

// Lọc như trang nước của iWater: logo thương hiệu, quy cách bình/chai, rồi loại nước.
export const shopGroups = [
  { key: 'jug-tap', label: 'Bình 19L – 20L vòi bấm', match: (p: ShopProduct) => p.catalog?.packaging === 'Bình có vòi' },
  { key: 'jug-dispenser', label: 'Bình 19L – 20L úp máy', match: (p: ShopProduct) => p.catalog?.packaging === 'Bình úp máy' },
  { key: 'small-350', label: 'Chai nhỏ 350ml', match: (p: ShopProduct) => isBottle(p) && volume(p) > 0 && volume(p) <= 355 },
  { key: 'small-500', label: 'Chai 500ml', match: (p: ShopProduct) => isBottle(p) && volume(p) > 355 && volume(p) <= 520 },
  { key: 'large', label: 'Chai lớn 750ml – 1,5L', match: (p: ShopProduct) => isBottle(p) && volume(p) > 520 && volume(p) <= 1500 },
  { key: 'can-5l', label: 'Bình 4,5L – 5L', match: (p: ShopProduct) => isBottle(p) && volume(p) > 1500 && volume(p) <= 6000 },
  { key: 'tin', label: 'Nước lon', match: (p: ShopProduct) => p.catalog?.packaging === 'Thùng lon' },
] as const

const volume = (product: ShopProduct) => product.catalog?.volumeMl ?? 0
const isBottle = (product: ShopProduct) => /chai/i.test(product.catalog?.packaging ?? '')

export type ShopGroupKey = (typeof shopGroups)[number]['key']

export const ALL = 'Tất cả'
export type ShopFilterState = { brand: string; group: string; category: string; query: string }
export const emptyFilters: ShopFilterState = { brand: ALL, group: ALL, category: ALL, query: '' }

/** Gộp tên viết khác nhau của cùng thương hiệu (Vihawa → Vĩnh Hảo, Rosee → Rosée). */
export const brandOf = (product: ShopProduct) => getBrandGroup(product.brand)?.name ?? (product.brand || 'Khác')
export const categoryOf = (product: ShopProduct) => product.catalog?.category ?? 'Khác'

const matches = (product: ShopProduct, filters: ShopFilterState, skip?: keyof ShopFilterState) =>
  (skip === 'brand' || filters.brand === ALL || brandOf(product) === filters.brand) &&
  (skip === 'group' || filters.group === ALL || Boolean(shopGroups.find((item) => item.key === filters.group)?.match(product))) &&
  (skip === 'category' || filters.category === ALL || categoryOf(product) === filters.category) &&
  normalizeSearch(`${product.name} ${product.brand}`).includes(normalizeSearch(filters.query.trim()))

/** Sản phẩm qua mọi bộ lọc; còn hàng xếp trước. */
export const filterProducts = (products: ShopProduct[], filters: ShopFilterState) =>
  products.filter((product) => matches(product, filters)).sort((a, b) => Number(b.available) - Number(a.available))

/** Số sản phẩm của mỗi lựa chọn, tính theo các bộ lọc khác đang chọn để không dẫn tới danh sách rỗng. */
export const countBy = (products: ShopProduct[], filters: ShopFilterState, key: keyof ShopFilterState, value: (product: ShopProduct) => boolean) =>
  products.filter((product) => matches(product, filters, key) && value(product)).length
