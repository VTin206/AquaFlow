import { useQuery } from '@tanstack/react-query'
import { reportApi, type ReportQuery, type ReportRow } from './reportApi'

/** Số liệu bán của một sản phẩm trong kỳ; `quantity` là số đã giao trừ số khách trả. */
export type ProductSale = { productId: string; name: string; unit: string; quantity: number; revenue: number }
export type SalesMetric = 'quantity' | 'revenue'
export const metricLabels: Record<SalesMetric, string> = { quantity: 'Số lượng bán', revenue: 'Doanh thu' }
export type ProductShare = { key: string; name: string; value: number; share: number; other?: boolean }

/** API trả tối đa 100 dòng một trang; đủ cho danh mục của một cửa hàng. */
const ALL_PRODUCTS = 100

const toSale = (row: ReportRow): ProductSale => ({
  productId: String(row.productId),
  name: String(row.name ?? ''),
  unit: String(row.unit ?? ''),
  quantity: Number(row.sold ?? 0) - Number(row.returned ?? 0),
  revenue: Number(row.revenue ?? 0),
})

/** Số bán của mọi sản phẩm trong kỳ (không phân trang) để xếp hạng và tính tỷ lệ. */
export function useProductSales(query: ReportQuery, enabled = true) {
  const result = useQuery({
    queryKey: ['live', 'reports', 'products', query, 0, ALL_PRODUCTS],
    queryFn: () => reportApi.section('products', query, 0, ALL_PRODUCTS),
    enabled,
  })
  return { ...result, data: result.data?.content.map(toSale) }
}

/** Sản phẩm có số dương theo tiêu chí, lớn nhất trước; bằng nhau thì theo tên để thứ tự không nhảy. */
export function rankProducts(rows: ProductSale[], metric: SalesMetric, limit?: number) {
  const ranked = rows.filter((row) => row[metric] > 0).sort((a, b) => b[metric] - a[metric] || a.name.localeCompare(b.name, 'vi'))
  return limit === undefined ? ranked : ranked.slice(0, limit)
}

/** Tỷ lệ từng sản phẩm trên tổng; ngoài `slices` sản phẩm đầu thì gộp vào "Khác" để biểu đồ tròn đọc được. */
export function productShares(rows: ProductSale[], metric: SalesMetric, slices = 5): ProductShare[] {
  const ranked = rankProducts(rows, metric)
  const total = ranked.reduce((sum, row) => sum + row[metric], 0)
  if (total <= 0) return []
  const head = ranked.slice(0, ranked.length > slices + 1 ? slices : ranked.length)
  const rest = ranked.slice(head.length)
  const shares: ProductShare[] = head.map((row) => ({ key: row.productId, name: row.name, value: row[metric], share: row[metric] / total }))
  if (rest.length) {
    const value = rest.reduce((sum, row) => sum + row[metric], 0)
    shares.push({ key: 'other', name: `Khác (${rest.length} sản phẩm)`, value, share: value / total, other: true })
  }
  return shares
}
