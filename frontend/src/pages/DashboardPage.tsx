import { ArrowRight, ArrowUpRight, Check, ChevronDown, ChevronRight, CircleDollarSign, FileBarChart, PackagePlus, PackageSearch, Plus, ShoppingBag, ShoppingCart, Truck, Waves } from 'lucide-react'
import { OrderTable } from '../components/OrderTable'
import { StatCard } from '../components/StatCard'
import { StockAlert } from '../components/StockAlert'
import type { Order, Product, Section } from '../types'
import { currency } from '../utils/format'

type DashboardPageProps = {
  orders: Order[]
  products: Product[]
  onNavigate: (section: Section) => void
  onCreateOrder: () => void
  onReceiveStock: () => void
  onChangeStatus: (id: string) => void
}

const weeklySales = [
  { d: 'T2', h: 42 },
  { d: 'T3', h: 60 },
  { d: 'T4', h: 50 },
  { d: 'T5', h: 74 },
  { d: 'T6', h: 57 },
  { d: 'T7', h: 87 },
  { d: 'CN', h: 68 },
]

export function DashboardPage({ orders, products, onNavigate, onCreateOrder, onReceiveStock, onChangeStatus }: DashboardPageProps) {
  const pending = orders.filter((order) => order.status === 'Chờ xác nhận').length
  const shipping = orders.filter((order) => order.status === 'Đang giao').length
  const revenue = orders.filter((order) => order.status === 'Đã hoàn tất').reduce((sum, order) => sum + order.total, 0) + 7620000
  const lowStock = products.filter((product) => product.stock <= product.threshold)

  return (
    <div className="page-content">
      <section className="welcome-banner">
        <div className="welcome-copy">
          <span className="banner-kicker">
            <span className="sparkle">✳</span> BẢN TIN VẬN HÀNH <span className="banner-date">· Hôm nay</span>
          </span>
          <h2>Cửa hàng đang vận hành tốt.</h2>
          <p>
            Bạn có <strong>{pending} đơn hàng mới</strong> cần xác nhận và <strong>{shipping} chuyến giao</strong> đang được xử lý.
          </p>
          <button className="banner-link" onClick={() => onNavigate('orders')}>
            Xem hoạt động hôm nay <ArrowRight size={15} />
          </button>
        </div>
        <div className="banner-art">
          <div className="art-circle art-circle-one" />
          <div className="art-circle art-circle-two" />
          <div className="art-bottle">
            <div className="bottle-cap" />
            <div className="bottle-neck" />
            <div className="bottle-body">
              <Waves size={38} />
            </div>
          </div>
          <div className="art-drop drop-one" />
          <div className="art-drop drop-two" />
        </div>
      </section>

      <section className="stats-grid">
        <StatCard label="Doanh thu hôm nay" value={currency(revenue)} delta="12,8%" detail="so với hôm qua" icon={CircleDollarSign} tone="mint" trend="up" />
        <StatCard label="Đơn hàng mới" value={`${(orders.length + 19).toString().padStart(2, '0')}`} delta="8,2%" detail="so với hôm qua" icon={ShoppingBag} tone="lavender" trend="up" />
        <StatCard label="Đang giao hàng" value="08" delta="03 đơn" detail="đang giao trễ" icon={Truck} tone="peach" trend="warning" />
        <StatCard label="Sản phẩm sắp hết" value={lowStock.length.toString().padStart(2, '0')} delta="Cần nhập thêm" detail="kiểm tra tồn kho" icon={PackageSearch} tone="yellow" trend="warning" />
      </section>

      <div className="dashboard-grid">
        <section className="surface sales-panel">
          <div className="section-head">
            <div>
              <span className="eyebrow">HIỆU SUẤT KINH DOANH</span>
              <h2>Doanh thu bán hàng</h2>
            </div>
            <button className="select-button" onClick={() => onNavigate('reports')}>
              7 ngày qua <ChevronDown size={14} />
            </button>
          </div>
          <div className="chart-summary">
            <strong>{currency(revenue)}</strong>
            <span className="trend-chip">
              <ArrowUpRight size={14} /> 12,8%
            </span>
            <span className="chart-caption">so với tuần trước</span>
          </div>
          <div className="chart">
            <div className="chart-y-labels">
              <span>3tr</span>
              <span>2tr</span>
              <span>1tr</span>
              <span>0</span>
            </div>
            <div className="chart-plot">
              <div className="chart-gridline line-one" />
              <div className="chart-gridline line-two" />
              <div className="chart-gridline line-three" />
              <div className="chart-bars">
                {weeklySales.map((item, index) => (
                  <div className="chart-column" key={item.d}>
                    <div className={`bar ${index === 5 ? 'bar-highlight' : ''}`} style={{ height: `${item.h}%` }}>
                      <span>{index === 5 ? '2,6tr' : ''}</span>
                    </div>
                    <span className="bar-label">{item.d}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="chart-footnote">
            <span>
              <i className="legend-dot" /> Doanh thu
            </span>
            <span>Cập nhật lần cuối: 10:42 hôm nay</span>
          </div>
        </section>

        <section className="surface inventory-panel">
          <div className="section-head">
            <div>
              <span className="eyebrow">CẦN THEO DÕI</span>
              <h2>Tồn kho cần chú ý</h2>
            </div>
            <button className="text-link" onClick={() => onNavigate('inventory')}>
              Chi tiết <ArrowRight size={14} />
            </button>
          </div>
          <div className="stock-alert-list">
            {lowStock.slice(0, 3).map((product) => (
              <StockAlert key={product.id} product={product} />
            ))}
            {lowStock.length === 0 && (
              <div className="empty-inline">
                <Check size={18} /> Tồn kho đang ở mức an toàn.
              </div>
            )}
          </div>
          <button className="button button-outline full-button" onClick={onReceiveStock}>
            <Plus size={16} /> Tạo phiếu nhập kho
          </button>
        </section>
      </div>

      <section className="surface recent-orders">
        <div className="section-head">
          <div>
            <span className="eyebrow">CẬP NHẬT MỚI NHẤT</span>
            <h2>Đơn hàng gần đây</h2>
          </div>
          <button className="text-link" onClick={() => onNavigate('orders')}>
            Xem tất cả <ArrowRight size={14} />
          </button>
        </div>
        <OrderTable orders={orders.slice(0, 4)} onChangeStatus={onChangeStatus} compact />
      </section>

      <div className="quick-actions">
        <button onClick={onCreateOrder}>
          <span className="quick-icon teal">
            <ShoppingCart size={17} />
          </span>
          <span>
            <strong>Tạo đơn hàng</strong>
            <small>Ghi nhận đơn mới</small>
          </span>
          <ChevronRight size={16} />
        </button>
        <button onClick={onReceiveStock}>
          <span className="quick-icon blue">
            <PackagePlus size={17} />
          </span>
          <span>
            <strong>Nhập hàng</strong>
            <small>Cập nhật lượng tồn</small>
          </span>
          <ChevronRight size={16} />
        </button>
        <button onClick={() => onNavigate('delivery')}>
          <span className="quick-icon orange">
            <Truck size={17} />
          </span>
          <span>
            <strong>Điều phối giao</strong>
            <small>Quản lý chuyến giao</small>
          </span>
          <ChevronRight size={16} />
        </button>
        <button onClick={() => onNavigate('reports')}>
          <span className="quick-icon purple">
            <FileBarChart size={17} />
          </span>
          <span>
            <strong>Xem báo cáo</strong>
            <small>Phân tích cửa hàng</small>
          </span>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
