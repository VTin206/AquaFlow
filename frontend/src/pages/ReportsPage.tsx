import { ArrowUpRight, CalendarDays, ChevronDown } from 'lucide-react'
import type { Order, Product } from '../types'
import { currency } from '../utils/format'

type ReportsPageProps = { orders: Order[]; products: Product[] }

const dailyRevenue = [48, 61, 55, 77, 67, 88, 70, 82, 59, 76, 91, 72]

export function ReportsPage({ orders, products }: ReportsPageProps) {
  const gross = orders.reduce((sum, order) => sum + order.total, 0)
  const completed = orders.filter((order) => order.status === 'Đã hoàn tất').length

  return (
    <div className="page-content subpage-content">
      <div className="report-filter surface">
        <div>
          <strong>Báo cáo hoạt động</strong>
          <span>Dữ liệu minh họa cho cửa hàng</span>
        </div>
        <button className="select-button">
          <CalendarDays size={15} /> Tháng 10, 2026 <ChevronDown size={14} />
        </button>
      </div>

      <div className="report-stat-grid">
        <div className="report-stat surface">
          <span>Doanh thu thuần</span>
          <strong>{currency(gross + 7620000)}</strong>
          <small className="positive">
            <ArrowUpRight size={13} /> 12,8% so với kỳ trước
          </small>
        </div>
        <div className="report-stat surface">
          <span>Đơn hàng hoàn tất</span>
          <strong>{completed + 84}</strong>
          <small className="positive">
            <ArrowUpRight size={13} /> 8,4% so với kỳ trước
          </small>
        </div>
        <div className="report-stat surface">
          <span>Giá trị đơn trung bình</span>
          <strong>{currency(286000)}</strong>
          <small className="positive">
            <ArrowUpRight size={13} /> 3,2% so với kỳ trước
          </small>
        </div>
      </div>

      <div className="report-grid">
        <section className="surface report-chart">
          <div className="section-head">
            <div>
              <span className="eyebrow">TỔNG QUAN DOANH THU</span>
              <h2>Doanh thu theo ngày</h2>
            </div>
            <div className="legend">
              <i /> Doanh thu
            </div>
          </div>
          <div className="report-bars">
            {dailyRevenue.map((height, i) => (
              <div className="report-bar-col" key={i}>
                <i style={{ height: `${height}%` }} />
                <span>{i + 1}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="surface report-stock">
          <div className="section-head">
            <div>
              <span className="eyebrow">HÀNG HÓA</span>
              <h2>Tồn kho hiện tại</h2>
            </div>
          </div>
          {products.slice(0, 4).map((product) => (
            <div className="report-stock-row" key={product.id}>
              <span>{product.name}</span>
              <strong>
                {product.stock} {product.unit.toLowerCase()}
              </strong>
              <i className={product.stock <= product.threshold ? 'is-low' : ''} />
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
