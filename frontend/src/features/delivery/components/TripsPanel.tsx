import { useState } from 'react'
import { Button, Card, Col, Empty, Progress, Row, Skeleton, Table, Tag } from 'antd'
import { Truck } from 'lucide-react'
import { QueryError } from '@/shared/components/QueryError'
import { Money } from '@/shared/components/Money'
import { dueTone } from '@/shared/utils/money'
import { currency } from '@/shared/utils/format'
import { canDispatch } from '@/features/orders/orderService'
import { amountDue, jugCount, orderedAtOf, type Order } from '@/features/orders/types'
import { useOrders } from '@/features/orders/useOrders'
import { openIn } from '../tripService'
import { useTrips } from '../useTrips'
import { CreateTripModal } from './CreateTripModal'
import { TripDrawer } from './TripDrawer'
import { TripStatusTag } from './TripStatusTag'

/** Xếp đơn chờ giao vào chuyến và theo dõi các chuyến đang chạy. */
export function TripsPanel() {
  const ordersQuery = useOrders()
  const tripsQuery = useTrips()
  const [selected, setSelected] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [tripId, setTripId] = useState<string | null>(null)

  const orders = ordersQuery.data ?? []
  const trips = tripsQuery.data ?? []
  // Đơn còn việc ở một chuyến chưa đối soát thì không xếp thêm; đơn giao lại (đã kiểm hàng hoàn) quay về danh sách chờ.
  const busy = new Set(
    trips
      .filter((trip) => trip.status !== 'Đã đối soát')
      .flatMap((trip) =>
        trip.orderIds.filter((id) => {
          const order = orders.find((item) => item.id === id)
          return !order || openIn(trip, order)
        }),
      ),
  )
  const waiting = orders.filter((order) => canDispatch(order) && !busy.has(order.id))
  const chosen = waiting.filter((order) => selected.includes(order.id))
  const activeTrips = trips.filter((trip) => trip.status !== 'Đã đối soát')
  const settledTrips = trips.filter((trip) => trip.status === 'Đã đối soát')

  if (ordersQuery.isError) return <QueryError error={ordersQuery.error} onRetry={ordersQuery.refetch} />

  return (
    <>
      <Card
        className="af-card"
        styles={{ body: { padding: 0 } }}
        title={
          <span className="af-panel-title">
            Đơn chờ xếp chuyến <Tag>{waiting.length}</Tag>
          </span>
        }
        extra={
          <Button type="primary" icon={<Truck size={16} />} disabled={!chosen.length} onClick={() => setCreating(true)}>
            {chosen.length ? `Tạo chuyến (${chosen.length} đơn)` : 'Chọn đơn để tạo chuyến'}
          </Button>
        }
      >
        <Table<Order>
          className="af-data-table af-table-flush"
          size="middle"
          rowKey="id"
          loading={ordersQuery.isPending}
          dataSource={waiting}
          pagination={false}
          scroll={{ x: 820, y: 320 }}
          rowSelection={{ selectedRowKeys: chosen.map((order) => order.id), onChange: (keys) => setSelected(keys as string[]) }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Không có đơn chờ giao. Xác nhận đơn ở trang Đơn hàng để xếp chuyến."
              />
            ),
          }}
          columns={[
            {
              title: 'Đơn',
              dataIndex: 'id',
              width: 130,
              render: (id: string, order) => (
                <div className="af-cell-stack">
                  <span className="af-strong">{id}</span>
                  {order.dispatches?.length ? (
                    <small className="af-text-warning">Giao lại</small>
                  ) : (
                    <small title={orderedAtOf(order).full}>{orderedAtOf(order).label}</small>
                  )}
                </div>
              ),
            },
            {
              title: 'Khách / địa chỉ',
              key: 'customer',
              render: (_, order) => (
                <div className="af-cell-stack">
                  <span>{order.customer}</span>
                  <small className="af-cell-truncate" title={order.address}>
                    {order.address}
                  </small>
                </div>
              ),
            },
            {
              title: 'Hẹn giao',
              dataIndex: 'appointment',
              width: 140,
              render: (value?: string) =>
                value
                  ? new Date(value).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
                  : '—',
            },
            { title: 'Bình', key: 'jugs', width: 80, align: 'right', render: (_, order) => jugCount(order) || '—' },
            {
              title: 'Cần thu',
              key: 'due',
              width: 130,
              align: 'right',
              render: (_, order) => <Money value={amountDue(order)} tone={dueTone(amountDue(order))} />,
            },
          ]}
        />
      </Card>

      <div className="af-section-heading">
        <h2>Chuyến giao</h2>
        <span>Ghi kết quả từng điểm, đối soát tiền và vỏ khi tài xế về</span>
      </div>
      {tripsQuery.isPending ? (
        <Skeleton active />
      ) : activeTrips.length === 0 && settledTrips.length === 0 ? (
        <Card>
          <Empty description="Chưa có chuyến nào hôm nay." />
        </Card>
      ) : (
        <Row gutter={[12, 12]}>
          {[...activeTrips, ...settledTrips].map((trip) => {
            const stops = trip.orderIds.map((id) => orders.find((order) => order.id === id)).filter((order) => order !== undefined)
            const finished = trip.departedAt ? stops.filter((order) => order.status !== 'Đang giao').length : 0
            return (
              <Col key={trip.id} xs={24} md={12} xl={8}>
                <Card size="small" className="af-trip-card" hoverable onClick={() => setTripId(trip.id)}>
                  <div className="af-trip-card-head">
                    <strong>{trip.id}</strong>
                    <TripStatusTag status={trip.status} />
                  </div>
                  <div className="af-delivery-line">
                    <Truck size={14} /> {trip.driver}
                    {trip.vehicle ? ` · ${trip.vehicle}` : ''}
                  </div>
                  <Progress
                    percent={Math.round((finished / Math.max(1, stops.length)) * 100)}
                    size="small"
                    format={() => `${finished}/${stops.length}`}
                  />
                  <div className="af-trip-card-foot">
                    <small>Cần thu {currency(stops.reduce((sum, order) => sum + amountDue(order), 0))}</small>
                    <Button size="small" type={trip.status === 'Chờ đối soát' ? 'primary' : 'default'}>
                      {trip.status === 'Chờ xuất phát' ? 'Xuất phát' : trip.status === 'Chờ đối soát' ? 'Đối soát' : 'Chi tiết'}
                    </Button>
                  </div>
                </Card>
              </Col>
            )
          })}
        </Row>
      )}

      <CreateTripModal
        orders={chosen}
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          setSelected([])
          setTripId(id)
        }}
      />
      {tripId && <TripDrawer key={tripId} tripId={tripId} onClose={() => setTripId(null)} />}
    </>
  )
}
