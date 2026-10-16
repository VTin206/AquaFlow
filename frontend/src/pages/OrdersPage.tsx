import { ChevronDown, ChevronLeft, ChevronRight, Filter } from 'lucide-react'
import { OrderTable } from '../components/OrderTable'
import { SearchField } from '../components/SearchField'
import type { Order } from '../types'

type OrdersPageProps = {
  orders: Order[]
  query: string
  setQuery: (value: string) => void
  orderFilter: string
  setOrderFilter: (value: string) => void
  onChangeStatus: (id: string) => void
}

export function OrdersPage({ orders, query, setQuery, orderFilter, setOrderFilter, onChangeStatus }: OrdersPageProps) {
  return (
    <div className="page-content subpage-content">
      <div className="surface data-surface">
        <div className="toolbar">
          <div className="toolbar-copy">
            <strong>Danh sách đơn hàng</strong>
            <span>{orders.length} đơn đang hiển thị</span>
          </div>
          <div className="toolbar-controls">
            <SearchField value={query} onChange={setQuery} placeholder="Tìm mã đơn, khách hàng..." />
            <label className="filter-select">
              <Filter size={15} />
              <select value={orderFilter} onChange={(event) => setOrderFilter(event.target.value)}>
                <option>Tất cả trạng thái</option>
                <option>Chờ xác nhận</option>
                <option>Đang chuẩn bị</option>
                <option>Đang giao</option>
                <option>Đã hoàn tất</option>
              </select>
              <ChevronDown size={14} />
            </label>
          </div>
        </div>
        <OrderTable orders={orders} onChangeStatus={onChangeStatus} />
      </div>
      <div className="table-footer">
        <span>
          Đang hiển thị <strong>{orders.length}</strong> đơn hàng
        </span>
        <div className="pagination">
          <button aria-label="Trang trước">
            <ChevronLeft size={16} />
          </button>
          <button className="current-page">1</button>
          <button>2</button>
          <button>3</button>
          <span>…</span>
          <button>12</button>
          <button aria-label="Trang sau">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
