import { Card, Empty } from 'antd'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { QueryError } from '@/shared/components/QueryError'
import { ProductShareChart } from '@/features/reports/charts'
import { rankProducts, useProductSales } from '@/features/reports/productSales'
import { dayFromToday } from '@/features/reports/reportService'

/** Số ngày tính "bán chạy" trên trang tổng quan. */
const DAYS = 30

/**
 * Sản phẩm bán chạy 30 ngày qua theo số lượng: vành khuyên cho tỷ lệ, chú thích bên cạnh là bảng xếp hạng
 * (tên, %, số lượng). Chỉ hiện cho người xem được báo cáo, cùng quyền với API báo cáo.
 */
export function BestSellersCard() {
  const range = { from: dayFromToday(-(DAYS - 1)), to: dayFromToday() }
  const sales = useProductSales(range)
  const params = new URLSearchParams({ tab: 'products', from: range.from, to: range.to })
  return (
    <Card
      title={`Bán chạy ${DAYS} ngày`}
      className="af-card"
      loading={sales.isPending}
      extra={
        <Link to={`/reports?${params}`} className="af-text-link">
          Xem chi tiết <ArrowRight size={14} />
        </Link>
      }
    >
      {sales.isError ? (
        <QueryError error={sales.error} onRetry={sales.refetch} />
      ) : !rankProducts(sales.data ?? [], 'quantity').length ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`Chưa bán sản phẩm nào ${DAYS} ngày qua.`} />
      ) : (
        <ProductShareChart rows={sales.data ?? []} metric="quantity" />
      )}
    </Card>
  )
}
