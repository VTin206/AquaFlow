import { brandGroups, getBrandGroup } from './catalogGroups'
import type { CatalogItem } from './useProductCatalog'

export type BrandRow = { name: string; aliases: string[]; logo?: string; count: number }

/** Thương hiệu đang có: danh sách chuẩn kèm tên gọi khác và logo, cộng các thương hiệu gõ tự do trên sản phẩm. */
export function brandRows(products: Pick<CatalogItem, 'brand'>[]): BrandRow[] {
  const nameOf = (brand: string) => getBrandGroup(brand)?.name ?? brand.trim()
  const counts = new Map<string, number>()
  products.forEach((product) => {
    const name = product.brand && product.brand !== 'Chưa có thương hiệu' ? nameOf(product.brand) : ''
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1)
  })
  const known = brandGroups.map((group) => ({ ...group, count: counts.get(group.name) ?? 0 }))
  const free = [...counts.keys()]
    .filter((name) => !brandGroups.some((group) => group.name === name))
    .map((name) => ({ name, aliases: [], count: counts.get(name) ?? 0 }))
  return [...known, ...free].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'vi'))
}
