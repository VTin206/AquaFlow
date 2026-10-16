import { ArrowRight, Check, Clock3, FileBarChart, MapPin, Package, Truck, Users } from 'lucide-react'
import { EmptyState } from '../components/StateViews'
import { StatusBadge } from '../components/StatusBadge'
import type { Order } from '../types'
import { currency } from '../utils/format'

type DeliveryPageProps = { orders: Order[]; onChangeStatus: (id: string) => void }

export function DeliveryPage({ orders, onChangeStatus }: DeliveryPageProps) {
  const deliveries = orders.filter((order) => order.method === 'Giao tận nơi' && order.status !== 'Đã hoàn tất')

  return (
    <div className="page-content subpage-content">
      <div className="delivery-overview">
        <div className="delivery-stat">
          <span className="delivery-stat-icon teal">
            <Truck size={19} />
          </span>
          <div>
            <small>Đơn cần giao</small>
            <strong>{deliveries.length + 4}</strong>
          </div>
        </div>
        <div className="delivery-stat">
          <span className="delivery-stat-icon green">
            <Check size={19} />
          </span>
          <div>
            <small>Đã giao thành công</small>
            <strong>16</strong>
          </div>
        </div>
        <div className="delivery-stat">
          <span className="delivery-stat-icon amber">
            <Clock3 size={19} />
          </span>
          <div>
            <small>Giao trễ</small>
            <strong>03</strong>
          </div>
        </div>
        <div className="delivery-stat">
          <span className="delivery-stat-icon purple">
            <Users size={19} />
          </span>
          <div>
            <small>Nhân viên giao hàng</small>
            <strong>
              04 <small>đang hoạt động</small>
            </strong>
          </div>
        </div>
      </div>

      <div className="surface data-surface">
        <div className="toolbar">
          <div className="toolbar-copy">
            <strong>Đơn hàng đang giao</strong>
            <span>Chuyến giao trong ngày · 15/10/2026</span>
          </div>
          <button className="button button-secondary" onClick={() => window.print()}>
            <FileBarChart size={15} /> In danh sách
          </button>
        </div>
        <div className="delivery-list">
          {deliveries.map((order, index) => (
            <article className="delivery-row" key={order.id}>
              <div className="route-time">
                <span className={`route-indicator ${index === 0 ? 'active' : ''}`} />
                <strong>{index === 0 ? 'Đang giao' : 'Tiếp theo'}</strong>
                <small>{order.time}</small>
              </div>
              <div className="route-line">
                <i />
              </div>
              <div className="delivery-order">
                <div className="delivery-order-top">
                  <div>
                    <span className="order-id">#{order.id}</span>
                    <StatusBadge status={order.status} />
                  </div>
                  <strong>{currency(order.total)}</strong>
                </div>
                <h3>{order.customer}</h3>
                <p>
                  <MapPin size={14} />
                  {order.address}
                </p>
                <div className="delivery-order-bottom">
                  <span>
                    <Package size={14} />
                    {order.items}
                  </span>
                  <span>
                    <Truck size={14} /> Trần Quốc Bảo
                  </span>
                  <button className="text-link" onClick={() => onChangeStatus(order.id)}>
                    {order.status === 'Đang giao' ? 'Xác nhận giao' : 'Bắt đầu giao'} <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </article>
          ))}
          {deliveries.length === 0 && <EmptyState icon={Truck} title="Chưa có đơn giao đang xử lý" description="Đơn giao tận nơi chưa hoàn tất sẽ hiển thị tại đây." />}
        </div>
      </div>
    </div>
  )
}
