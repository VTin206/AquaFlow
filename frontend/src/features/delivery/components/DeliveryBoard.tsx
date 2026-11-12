import { useState } from 'react'
import { Badge, Card, Skeleton, Tag } from 'antd'
import { ChevronRight } from 'lucide-react'
import { MapLink } from '@/shared/address/MapLink'
import { ViewButton } from '@/shared/components/ViewButton'
import { Money } from '@/shared/components/Money'
import { QueryError } from '@/shared/components/QueryError'
import { dueTone } from '@/shared/utils/money'
import { OrderDetails } from '@/features/orders/components/OrderDetails'
import { useOrderList } from '@/features/orders/orderData'
import { isOverdue, knownAmountDue, type Order, type OrderStatus } from '@/features/orders/types'
import { localDay, dayFromToday } from '@/features/reports/reportService'
import { useLiveTrips } from '../useLiveTrips'
import { groupDeliveries, readCollapsed, writeCollapsed } from '../deliveryBoard'

const timeOfDay = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
/** Hôm nay chỉ hiện giờ; ngày khác hiện thêm ngày/tháng. */
const appointmentLabel = (iso?: string) => {
  if (!iso) return 'Chưa hẹn'
  if (localDay(iso) === dayFromToday()) return timeOfDay(iso)
  const date = new Date(iso)
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')} ${timeOfDay(iso)}`
}

type RowProps = { order: Order; failureReason?: string; orphan: boolean; onDetails: () => void }

function DeliveryRow({ order, failureReason, orphan, onDetails }: RowProps) {
  const code = order.code ?? order.id
  const due = knownAmountDue(order)
  const late = isOverdue(order)
  return (
    <li className="af-board-row">
      <time
        className={late ? 'af-text-danger' : order.appointment ? undefined : 'af-text-muted'}
        title={order.appointment && new Date(order.appointment).toLocaleString('vi-VN')}
      >
        {appointmentLabel(order.appointment)}
      </time>
      <div className="af-cell-stack">
        <span>
          {order.customer} <small>{code}</small>
        </span>
        {order.phone && (
          <small>
            <a href={`tel:${order.phone.replace(/\s/g, '')}`}>{order.phone}</a>
          </small>
        )}
      </div>
      <div className="af-cell-stack">
        <span>
          {[order.address, order.area].filter(Boolean).join(', ') || '—'}
          <MapLink address={[order.address, order.area].filter(Boolean).join(', ')} />
        </span>
        <small>{order.items}</small>
      </div>
      <span className="af-board-money">{due !== null && due > 0 && <Money value={due} tone={dueTone(due)} prefix="Thu " />}</span>
      <ViewButton subject={`đơn ${code}`} onClick={onDetails} />
      {(failureReason || orphan) && (
        <div className="af-board-note">
          {failureReason && <span className="af-text-danger">{failureReason}</span>}
          {orphan && (
            <Tag color="orange" title="Đơn đã xuất kho nhưng không có chuyến nên chưa ghi được kết quả giao.">
              Không thuộc chuyến nào
            </Tag>
          )}
        </div>
      )}
    </li>
  )
}

/** Theo dõi mọi đơn giao theo nhóm trạng thái, mỗi đơn một hàng; kể cả đơn chưa thuộc chuyến nào. */
export function DeliveryBoard() {
  const ordersQuery = useOrderList()
  const trips = useLiveTrips()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const toggle = (status: OrderStatus) => {
    const next = collapsed.includes(status) ? collapsed.filter((item) => item !== status) : [...collapsed, status]
    setCollapsed(next)
    writeCollapsed(next)
  }

  const stops = (trips.data ?? []).filter((trip) => trip.status !== 'CANCELLED').flatMap((trip) => trip.orders)
  const failures = new Map(
    stops
      .filter((stop) => stop.latestAttempt?.outcome === 'FAILED')
      .map((stop) => [String(stop.orderId), stop.latestAttempt?.failureReason ?? 'Giao thất bại']),
  )
  const inTrip = new Set(stops.map((stop) => String(stop.orderId)))
  const groups = groupDeliveries(ordersQuery.data ?? [], new Set(failures.keys()))
  const filled = groups.filter((group) => group.orders.length > 0)
  const empty = groups.filter((group) => group.orders.length === 0)

  if (ordersQuery.isError) {
    return (
      <Card>
        <QueryError error={ordersQuery.error} onRetry={ordersQuery.refetch} />
      </Card>
    )
  }
  return (
    <Card className="af-card">
      {ordersQuery.isPending ? (
        <Skeleton active />
      ) : (
        <>
          {filled.length === 0 && <p className="af-board-empty">Không có đơn giao nào đang chờ xử lý.</p>}
          {filled.map((group, index) => {
            const open = !collapsed.includes(group.status)
            const late = group.orders.filter((order) => isOverdue(order)).length
            const listId = `af-board-group-${index}`
            return (
              <section key={group.status} className="af-board-group" aria-label={group.title}>
                {/* Cả dòng tiêu đề là nút đóng/mở; nhóm đóng vẫn báo số đơn trễ để không bỏ sót việc gấp. */}
                <button
                  type="button"
                  className="af-board-head"
                  aria-expanded={open}
                  aria-controls={listId}
                  onClick={() => toggle(group.status)}
                >
                  <ChevronRight size={16} className={`af-board-chevron${open ? ' is-open' : ''}`} aria-hidden />
                  <Badge color={group.color} text={<strong>{group.title}</strong>} />
                  <span className="af-board-count">{group.orders.length}</span>
                  {late > 0 && <span className="af-board-late">· trễ {late}</span>}
                  {open && <span className="af-board-hint">{group.hint}</span>}
                </button>
                {open && (
                  <ul className="af-board-rows" id={listId}>
                    {group.orders.map((order) => (
                      <DeliveryRow
                        key={order.id}
                        order={order}
                        failureReason={failures.get(order.id)}
                        orphan={trips.isSuccess && order.status === 'Đang giao' && !inTrip.has(order.id)}
                        onDetails={() => setSelectedId(order.id)}
                      />
                    ))}
                  </ul>
                )}
              </section>
            )
          })}
          {/* Nhóm trống gộp thành một dòng chữ, không chiếm khung. */}
          {empty.length > 0 && filled.length > 0 && (
            <p className="af-board-empty">
              {empty.map((group, index) => (
                <span key={group.status}>
                  {index > 0 && ' · '}
                  {group.title} <strong>0</strong>
                </span>
              ))}
            </p>
          )}
        </>
      )}
      {selectedId && <OrderDetails id={selectedId} onClose={() => setSelectedId(null)} />}
    </Card>
  )
}
