import { Badge, Card, Col, Empty, Row, Skeleton, Typography } from 'antd'
import { MapPin, Package } from 'lucide-react'
import { Page } from '../../shared/components/Page'
import { QueryError } from '../../shared/components/QueryError'
import { currency } from '../../shared/utils/format'
import { AdvanceStatusButton } from '../orders/components/AdvanceStatusButton'
import type { Order, OrderStatus } from '../orders/types'
import { useOrders } from '../orders/useOrders'

// Bảng giao hàng: mỗi cột là một bước, đơn đi từ trái sang phải.
const columns: { status: OrderStatus; title: string; hint: string; color: string }[] = [
  { status: 'Chờ xác nhận', title: 'Chờ xác nhận', hint: 'Gọi lại cho khách để xác nhận', color: '#f59f00' },
  { status: 'Đang chuẩn bị', title: 'Đang chuẩn bị', hint: 'Soạn hàng, sẵn sàng xuất kho', color: '#1c7ed6' },
  { status: 'Đang giao', title: 'Đang giao', hint: 'Xác nhận khi khách đã nhận hàng', color: '#0b7a83' },
]

function DeliveryCard({ order }: { order: Order }) {
  return (
    <Card size="small" className="af-delivery-card">
      <div className="af-delivery-top">
        <Typography.Text strong>{order.id}</Typography.Text>
        <span className="af-money">{currency(order.total)}</span>
      </div>
      <div className="af-delivery-customer">{order.customer}</div>
      <div className="af-delivery-line">
        <MapPin size={14} /> {order.address}
      </div>
      <div className="af-delivery-line">
        <Package size={14} /> {order.items}
      </div>
      <div className="af-delivery-footer">
        <Typography.Text type="secondary">Đặt lúc {order.time}</Typography.Text>
        <AdvanceStatusButton order={order} />
      </div>
    </Card>
  )
}

export function DeliveryPage() {
  const ordersQuery = useOrders()
  const deliveries = (ordersQuery.data ?? []).filter((order) => order.method === 'Giao tận nơi')

  return (
    <Page title="Giao hàng" description="Theo dõi đơn giao tận nơi theo từng bước.">
      {ordersQuery.isError ? (
        <Card>
          <QueryError error={ordersQuery.error} onRetry={ordersQuery.refetch} />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {columns.map((column) => {
            const items = deliveries.filter((order) => order.status === column.status)
            return (
              <Col key={column.status} xs={24} lg={8}>
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
                    items.map((order) => <DeliveryCard key={order.id} order={order} />)
                  )}
                </div>
              </Col>
            )
          })}
        </Row>
      )}
    </Page>
  )
}
