import { useState } from 'react'
import { Card, Col, Empty, Row, Skeleton } from 'antd'
import { QueryError } from '@/shared/components/QueryError'
import { currency } from '@/shared/utils/format'
import { canDispatch } from '@/features/orders/orderService'
import { amountDue, jugCount, orderedAtOf } from '@/features/orders/types'
import { useOrders } from '@/features/orders/useOrders'
import { openIn } from '../tripService'
import { useTrips } from '../useTrips'
import { CreateTripModal } from './CreateTripModal'
import { TripDrawer } from './TripDrawer'
import { TripCard } from './TripCard'
import { WaitingOrdersCard, type WaitingOrder } from './WaitingOrdersCard'

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
  const rows: WaitingOrder[] = waiting.map((order) => ({
    id: order.id,
    code: order.code ?? order.id,
    customer: order.customer,
    address: order.address,
    appointment: order.appointment,
    jugs: jugCount(order),
    due: amountDue(order),
    redelivery: Boolean(order.dispatches?.length),
    orderedAt: orderedAtOf(order),
  }))
  const activeTrips = trips.filter((trip) => trip.status !== 'Đã đối soát')
  const settledTrips = trips.filter((trip) => trip.status === 'Đã đối soát')

  if (ordersQuery.isError) return <QueryError error={ordersQuery.error} onRetry={ordersQuery.refetch} />

  return (
    <>
      <WaitingOrdersCard
        orders={rows}
        loading={ordersQuery.isPending}
        selected={selected}
        onSelect={setSelected}
        onCreate={() => setCreating(true)}
      />

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
                <TripCard
                  code={trip.id}
                  status={trip.status}
                  driver={trip.driver}
                  vehicle={trip.vehicle}
                  finished={finished}
                  total={stops.length}
                  dueLabel={`Cần thu ${currency(stops.reduce((sum, order) => sum + amountDue(order), 0))}`}
                  onOpen={() => setTripId(trip.id)}
                />
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
