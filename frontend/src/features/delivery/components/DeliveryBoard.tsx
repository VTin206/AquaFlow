import { useState } from 'react'
import { Badge, Button, Card, Col, Empty, Row, Skeleton, Tag, Typography } from 'antd'
import { Clock3, MapPin, Package, Phone } from 'lucide-react'
import { MapLink } from '@/shared/address/MapLink'
import { ViewButton } from '@/shared/components/ViewButton'
import { Money } from '@/shared/components/Money'
import { QueryError } from '@/shared/components/QueryError'
import { useIsDemo } from '@/shared/features'
import { dueTone } from '@/shared/utils/money'
import { AdvanceStatusButton } from '@/features/orders/components/AdvanceStatusButton'
import { OrderDetails } from '@/features/orders/components/OrderDetails'
import { useOrderList } from '@/features/orders/orderData'
import { knownAmountDue, type Order, type OrderStatus } from '@/features/orders/types'
import { useLiveTrips } from '../useLiveTrips'

// Mỗi cột là một bước, đơn đi từ trái sang phải. Bản dùng thử xác nhận là chuyển thẳng sang chuẩn bị nên cột "Đã xác nhận" luôn trống.
const columns: { status: OrderStatus; title: string; hint: string; color: string }[] = [
  { status: 'Chờ xác nhận', title: 'Chờ xác nhận', hint: 'Gọi lại cho khách để xác nhận', color: '#f59f00' },
  { status: 'Đã xác nhận', title: 'Đã xác nhận', hint: 'Đã giữ hàng, chuyển sang soạn hàng', color: '#4263eb' },
  { status: 'Đang chuẩn bị', title: 'Đang chuẩn bị', hint: 'Xếp vào chuyến, xuất kho ở chi tiết chuyến', color: '#1c7ed6' },
  { status: 'Đang giao', title: 'Đang giao', hint: 'Xác nhận khi khách đã nhận hàng', color: '#0b7a83' },
  { status: 'Giao thất bại', title: 'Giao thất bại', hint: 'Kiểm hàng hoàn ở Kho hàng rồi giao lại', color: '#c34444' },
]

type CardProps = { order: Order; failureReason?: string; orphan: boolean; action?: React.ReactNode; onDetails: () => void }

function DeliveryCard({ order, failureReason, orphan, action, onDetails }: CardProps) {
  const code = order.code ?? order.id
  const due = knownAmountDue(order)
  return (
    <Card size="small" className="af-delivery-card">
      <div className="af-delivery-top">
        <Button type="link" size="small" className="af-cell-truncate" title={code} onClick={onDetails}>
          {code}
        </Button>
        {due !== null && <Money value={due} tone={dueTone(due)} prefix="Thu " />}
      </div>
      <div className="af-delivery-customer">{order.customer}</div>
      <div className="af-delivery-line">
        <MapPin size={14} />
        <span>
          {order.address}
          <MapLink address={[order.address, order.area].filter(Boolean).join(', ')} />
        </span>
      </div>
      {order.phone && (
        <div className="af-delivery-line">
          <Phone size={14} />
          <a href={`tel:${order.phone.replace(/\s/g, '')}`}>{order.phone}</a>
        </div>
      )}
      {order.appointment && (
        <div className="af-delivery-line">
          <Clock3 size={14} />
          {new Date(order.appointment).toLocaleString('vi-VN')}
        </div>
      )}
      <div className="af-delivery-line">
        <Package size={14} /> {order.items}
      </div>
      {failureReason && (
        <Typography.Paragraph type="danger" className="af-delivery-reason">
          {failureReason}
        </Typography.Paragraph>
      )}
      {orphan && (
        <Tag color="orange" className="af-delivery-reason" title="Đơn đã xuất kho nhưng không có chuyến nên chưa ghi được kết quả giao.">
          Không thuộc chuyến nào
        </Tag>
      )}
      <div className="af-delivery-footer">
        <ViewButton subject={`đơn ${code}`} onClick={onDetails} />
        {action}
      </div>
    </Card>
  )
}

/** Bảng theo dõi mọi đơn giao, kể cả đơn chưa thuộc chuyến nào. */
export function DeliveryBoard() {
  const demo = useIsDemo()
  const ordersQuery = useOrderList()
  const trips = useLiveTrips(!demo)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const deliveries = (ordersQuery.data ?? []).filter((order) => order.method === 'Giao tận nơi')

  // BE giữ đơn giao thất bại ở OUT_FOR_DELIVERY và chỉ ghi kết quả trên chuyến, nên suy ra cột từ lần giao gần nhất.
  const stops = (trips.data ?? []).filter((trip) => trip.status !== 'CANCELLED').flatMap((trip) => trip.orders)
  const failures = new Map(
    stops.filter((stop) => stop.latestAttempt?.outcome === 'FAILED').map((stop) => [String(stop.orderId), stop.latestAttempt?.failureReason ?? 'Giao thất bại']),
  )
  const inTrip = new Set(stops.map((stop) => String(stop.orderId)))
  const columnOf = (order: Order): OrderStatus => (order.status === 'Đang giao' && failures.has(order.id) ? 'Giao thất bại' : order.status)
  const failureOf = (order: Order) =>
    demo
      ? order.status === 'Giao thất bại'
        ? order.history.filter((event) => event.message.startsWith('Giao thất bại')).at(-1)?.message
        : undefined
      : failures.get(order.id)

  if (ordersQuery.isError) {
    return (
      <Card>
        <QueryError error={ordersQuery.error} onRetry={ordersQuery.refetch} />
      </Card>
    )
  }
  return (
    <>
      <Row gutter={[16, 16]}>
        {columns
          .map((column) => {
            const items = deliveries.filter((order) => columnOf(order) === column.status)
            return (
              <Col key={column.status} flex="1 1 260px" style={{ minWidth: 0 }}>
                <div className="af-board-column">
                  <div className="af-board-head">
                    <Badge color={column.color} text={<strong>{column.title}</strong>} />
                    <span className="af-board-count">{items.length}</span>
                  </div>
                  <Typography.Text type="secondary" className="af-board-hint">
                    {column.hint}
                  </Typography.Text>
                  {ordersQuery.isPending ? (
                    <Skeleton active />
                  ) : items.length === 0 ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có đơn" />
                  ) : (
                    items.map((order) => (
                      <DeliveryCard
                        key={order.id}
                        order={order}
                        failureReason={failureOf(order)}
                        orphan={!demo && trips.isSuccess && order.status === 'Đang giao' && !inTrip.has(order.id)}
                        action={demo ? <AdvanceStatusButton order={order} /> : undefined}
                        onDetails={() => setSelectedId(order.id)}
                      />
                    ))
                  )}
                </div>
              </Col>
            )
          })}
      </Row>
      {selectedId && <OrderDetails id={selectedId} onClose={() => setSelectedId(null)} />}
    </>
  )
}
