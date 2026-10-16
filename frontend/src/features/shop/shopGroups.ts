import type { ShopProduct } from './shopService'

// Nhóm theo quy cách như menu của iWater: khách tìm theo loại bình/chai trước, rồi mới tới thương hiệu.
export const shopGroups = [
  { key: 'jug-tap', label: 'Bình 19–20L có vòi', match: (p: ShopProduct) => p.catalog?.packaging === 'Bình có vòi' },
  { key: 'jug-dispenser', label: 'Bình 19–20L úp máy', match: (p: ShopProduct) => p.catalog?.packaging === 'Bình úp máy' },
  { key: 'small-350', label: 'Chai nhỏ 330–350ml', match: (p: ShopProduct) => isBottle(p) && volume(p) > 0 && volume(p) <= 355 },
  { key: 'small-500', label: 'Chai 450–500ml', match: (p: ShopProduct) => isBottle(p) && volume(p) > 355 && volume(p) <= 520 },
  { key: 'large', label: 'Chai lớn 750ml–1,5L', match: (p: ShopProduct) => isBottle(p) && volume(p) > 520 && volume(p) <= 1500 },
  { key: 'can-5l', label: 'Bình 4,5–5L', match: (p: ShopProduct) => isBottle(p) && volume(p) > 1500 && volume(p) <= 6000 },
  { key: 'tin', label: 'Nước lon', match: (p: ShopProduct) => p.catalog?.packaging === 'Thùng lon' },
] as const

const volume = (product: ShopProduct) => product.catalog?.volumeMl ?? 0
const isBottle = (product: ShopProduct) => /chai/i.test(product.catalog?.packaging ?? '')

export type ShopGroupKey = (typeof shopGroups)[number]['key']
