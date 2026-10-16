import { useState } from 'react'
import { Badge, Button, Card, Col, Empty, Row, Segmented, Skeleton, Typography } from 'antd'
import { Clock3, Eye, MapPin, Package, Phone } from 'lucide-react'
import { Page } from '../../shared/components/Page'
import { QueryError } from '../../shared/components/QueryError'
import { currency } from '../../shared/utils/format'
import { AdvanceStatusButton } from '../orders/components/AdvanceStatusButton'
import { amountDue, type Order, type OrderStatus } from '../orders/types'
import { useOrders } from '../orders/useOrders'
import { OrderDetailsModal } from '../orders/components/OrderDetailsModal'
import { TripsPanel } from './components/TripsPanel'

// Bảng giao hàng: mỗi cột là một bước, đơn đi từ trái sang phải.
const columns: { status: OrderStatus; title: string; hint: string; color: string }[] = [
  { status: 'Chờ xác nhận', title: 'Chờ xác nhận', hint: 'Gọi lại cho khách để xác nhận', color: '#f59f00' },
  { status: 'Đang chuẩn bị', title: 'Đang chuẩn bị', hint: 'Soạn hàng, sẵn sàng xuất kho', color: '#1c7ed6' },
  { status: 'Đang giao', title: 'Đang giao', hint: 'Xác nhận khi khách đã nhận hàng', color: '#0b7a83' },
  { status: 'Giao thất bại', title: 'Giao thất bại', hint: 'Kiểm tra lý do trước khi giao lại', color: '#c34444' },
]

function DeliveryCard({ order, onDetails }: { order: Order; onDetails: () => void }) {
  return (
    <Card size="small" className="af-delivery-card">
      <div className="af-delivery-top">
        <Button type="link" size="small" onClick={onDetails}>
          {order.id}
        </Button>
        <span className="af-money">Thu {currency(amountDue(order))}</span>
      </div>
      <div className="af-delivery-customer">{order.customer}</div>
      <div className="af-delivery-line">
        <MapPin size={14} /> {order.address}
      </div>
      <div className="af-delivery-line">
        <Phone size={14} />
        <a href={`tel:${order.phone.replace(/\s/g, '')}`}>{order.phone}</a>
      </div>
      {order.appointment && (
        <div className="af-delivery-line">
          <Clock3 size={14} />
          {new Date(order.appointment).toLocaleString('vi-VN')}
        </div>
      )}
      <div className="af-delivery-line">
        <Package size={14} /> {order.items}
      </div>
      {order.status === 'Giao thất bại' && (
        <Typography.Paragraph type="danger" className="af-delivery-reason">
          {order.history.at(-1)?.message}
        </Typography.Paragraph>
      )}
      <div className="af-delivery-footer">
        <Button size="small" icon={<Eye size={15} />} onClick={onDetails} aria-label={`Chi tiết đơn ${order.id}`}>Chi tiết</Button>
        <AdvanceStatusButton order={order} />
      </div>
    </Card>
  )
}

export function DeliveryPage() {
  const ordersQuery = useOrders()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [view, setView] = useState<'trips' | 'board'>('trips')
  const deliveries = (ordersQuery.data ?? []).filter((order) => order.method === 'Giao tận nơi')

  return (
    <Page
      title="Giao hàng"
      description="Xếp đơn vào chuyến, ghi kết quả từng điểm giao và đối soát tiền, vỏ khi tài xế về."
      actions={
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'trips', label: 'Chuyến giao' },
            { value: 'board', label: 'Bảng theo dõi đơn' },
          ]}
        />
      }
    >
      {view === 'trips' ? (
        <TripsPanel />
      ) : ordersQuery.isError ? (
        <Card>
          <QueryError error={ordersQuery.error} onRetry={ordersQuery.refetch} />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {columns.map((column) => {
            const items = deliveries.filter((order) => order.status === column.status)
            return (
              <Col key={column.status} xs={24} md={12} xxl={6}>
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
                    items.map((order) => <DeliveryCard key={order.id} order={order} onDetails={() => setSelectedId(order.id)} />)
                  )}
                </div>
              </Col>
            )
          })}
        </Row>
      )}
      {selectedId && <OrderDetailsModal key={selectedId} orderId={selectedId} onClose={() => setSelectedId(null)} />}
    </Page>
  )
}
