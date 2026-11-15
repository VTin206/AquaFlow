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

/** Sản phẩm đang bán xếp từ bán ít nhất, kèm tồn kho để biết nên giảm nhập, khuyến mãi hay bổ sung hàng. */
export type SlowMover = ProductSale & {
  onHand: number
  available: number
  nearestExpiry?: string
  /** `unsold`: còn hàng mà cả kỳ không bán được; `outOfStock`: bán ít vì hết hàng, không phải vì ít khách mua. */
  status: 'unsold' | 'outOfStock' | 'slow'
}

type StockLike = { id: string; name: string; unit?: string; onHand: number; available: number; threshold?: number; nearestExpiry?: string }

/**
 * Ghép số bán trong kỳ với danh mục đang bán: sản phẩm không có dòng nào trong báo cáo (chưa bán) vẫn được tính với số 0.
 * Hàng đã ngừng bán (không có ngưỡng tối thiểu) bỏ qua. Bằng số bán thì sản phẩm tồn nhiều hơn đứng trước.
 */
export function slowMovers(sales: ProductSale[], stock: StockLike[], limit = 8): SlowMover[] {
  const sold = new Map(sales.map((row) => [row.productId, row]))
  const rows = stock
    .filter((item) => item.threshold !== undefined)
    .map((item): SlowMover => {
      const row = sold.get(item.id)
      const quantity = Math.max(0, row?.quantity ?? 0)
      return {
        productId: item.id,
        name: item.name,
        unit: item.unit ?? row?.unit ?? '',
        quantity,
        revenue: row?.revenue ?? 0,
        onHand: item.onHand,
        available: item.available,
        nearestExpiry: item.nearestExpiry,
        status: item.available <= 0 ? 'outOfStock' : quantity === 0 ? 'unsold' : 'slow',
      }
    })
  // Danh mục ít sản phẩm thì hàng bán đạt từ mức trung bình trở lên không tính là chậm, kể cả khi đứng cuối bảng.
  const average = rows.reduce((sum, row) => sum + row.quantity, 0) / Math.max(1, rows.length)
  return rows
    .filter((row) => row.status !== 'slow' || row.quantity < average)
    .sort((a, b) => a.quantity - b.quantity || b.onHand - a.onHand || a.name.localeCompare(b.name, 'vi'))
    .slice(0, limit)
}
