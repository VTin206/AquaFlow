import { Clock3, Ellipsis, Search } from 'lucide-react'
import type { Order } from '../types'
import { currency } from '../utils/format'
import { StatusBadge } from './StatusBadge'

type OrderTableProps = { orders: Order[]; onChangeStatus: (id: string) => void; compact?: boolean }

const initialsOf = (name: string) => name.split(' ').slice(-2).map((part) => part[0]).join('').toUpperCase()

export function OrderTable({ orders, onChangeStatus, compact = false }: OrderTableProps) {
  return (
    <div className="table-scroll">
      <table className={`data-table ${compact ? 'compact-table' : ''}`}>
        <thead>
          <tr>
            <th>MÃ ĐƠN</th>
            <th>KHÁCH HÀNG</th>
            <th>SẢN PHẨM</th>
            <th>THỜI GIAN</th>
            <th>TỔNG TIỀN</th>
            <th>TRẠNG THÁI</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td>
                <strong className="order-id">#{order.id}</strong>
              </td>
              <td>
                <div className="customer-cell">
                  <span className="customer-avatar">{initialsOf(order.customer)}</span>
                  <span>
                    <strong>{order.customer}</strong>
                    <small>{order.phone}</small>
                  </span>
                </div>
              </td>
              <td className="items-cell">{order.items}</td>
              <td>
                <span className="time-cell">
                  <Clock3 size={13} /> {order.time}
                </span>
              </td>
              <td>
                <strong className="amount-cell">{currency(order.total)}</strong>
              </td>
              <td>
                <StatusBadge status={order.status} />
              </td>
              <td>
                <button className="row-menu" aria-label={`Cập nhật ${order.id}`} title="Chuyển sang trạng thái tiếp theo" onClick={() => onChangeStatus(order.id)}>
                  <Ellipsis size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {orders.length === 0 && (
        <div className="empty-state">
          <Search size={22} />
          <strong>Không tìm thấy đơn hàng</strong>
          <span>Thử thay đổi từ khóa hoặc bộ lọc trạng thái.</span>
        </div>
      )}
    </div>
  )
}
