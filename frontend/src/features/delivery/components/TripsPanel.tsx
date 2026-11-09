import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { App, Card, Col, Empty, Row, Skeleton } from 'antd'
import { QueryError } from '@/shared/components/QueryError'
import { currency } from '@/shared/utils/format'
import { useOrderList } from '@/features/orders/orderData'
import { jugCount, knownAmountDue, orderedAtOf } from '@/features/orders/types'
import type { DeliveryTrip } from '../deliveryApi'
import { stopOrderId, useTripBackend } from '../tripBackend'
import { liveTripStatus, type TripViewStatus } from '../tripFocus'
import { CreateTripModal } from './CreateTripModal'
import { TripDrawer } from './TripDrawer'
import { TripCard } from './TripCard'
import { WaitingOrdersCard, type WaitingOrder } from './WaitingOrdersCard'

// Việc cần làm lên trước, chuyến đã xong xuống cuối.
const statusRank: Record<TripViewStatus, number> = { 'Chờ đối soát': 0, 'Chờ xuất phát': 1, 'Đang giao': 2, 'Đã đối soát': 3, 'Đã hủy': 4 }

/** Xếp đơn chờ giao vào chuyến và theo dõi các chuyến; dùng chung cho bản dùng thử và tài khoản thật. */
export function TripsPanel() {
  const [searchParams] = useSearchParams()
  const { message, modal } = App.useApp()
  const backend = useTripBackend()
  const tripsQuery = backend.useTrips()
  const availableQuery = backend.useAvailable()
  const ordersQuery = useOrderList()
  const [selected, setSelected] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [tripId, setTripId] = useState<number | null>(() => {
    const value = Number(searchParams.get('tripId'))
    return Number.isSafeInteger(value) && value > 0 ? value : null
  })

  const orders = ordersQuery.data ?? []
  const orderOf = (id: string) => orders.find((order) => order.id === id)
  const waiting: WaitingOrder[] = (availableQuery.data ?? []).map((item) => {
    const id = item.orderRef ?? String(item.id)
    const order = orderOf(id)
    return {
      id,
      code: item.orderCode,
      customer: item.recipientName || order?.customer || 'Khách hàng',
      address: item.deliveryAddress ?? '',
      appointment: order?.appointment,
      jugs: order ? jugCount(order) : 0,
      due: order ? knownAmountDue(order) : null,
      redelivery: item.redeliveryEligible,
      orderedAt: order ? orderedAtOf(order) : undefined,
    }
  })
  const chosen = waiting.filter((order) => selected.includes(order.id))
  const dueLabel = (trip: DeliveryTrip) => {
    const dues = trip.orders.map((stop) => {
      const order = orderOf(stopOrderId(stop))
      return order ? knownAmountDue(order) : null
    })
    const sum = dues.reduce<number>((total, due) => total + (due ?? 0), 0)
    return `Cần thu ${dues.includes(null) ? 'từ ' : ''}${currency(sum)}`
  }
  const trips = [...(tripsQuery.data ?? [])].sort((a, b) => statusRank[liveTripStatus(a)] - statusRank[liveTripStatus(b)] || b.id - a.id)

  return (
    <>
      <WaitingOrdersCard
        orders={waiting}
        loading={availableQuery.isPending}
        selected={selected}
        onSelect={setSelected}
        onCreate={() => setCreating(true)}
        error={availableQuery.isError && availableQuery.error ? <QueryError error={availableQuery.error} onRetry={availableQuery.refetch} /> : undefined}
      />

      <div className="af-section-heading">
        <h2>Chuyến giao</h2>
        <span>Ghi kết quả từng điểm, đối soát tiền và vỏ khi tài xế về</span>
      </div>
      {tripsQuery.isError && tripsQuery.error ? (
        <QueryError error={tripsQuery.error} onRetry={tripsQuery.refetch} />
      ) : tripsQuery.isPending ? (
        <Skeleton active />
      ) : trips.length === 0 ? (
        <Card>
          <Empty description="Chưa có chuyến nào." />
        </Card>
      ) : (
        <Row gutter={[12, 12]}>
          {trips.map((trip) => (
            <Col key={trip.id} xs={24} md={12} xl={8}>
              <TripCard
                code={`Chuyến #${trip.id}`}
                status={liveTripStatus(trip)}
                driver={trip.driverName ?? 'Chưa phân tài xế'}
                vehicle={trip.vehicle}
                finished={trip.orders.filter((stop) => stop.latestAttempt).length}
                total={trip.orders.length}
                dueLabel={dueLabel(trip)}
                onOpen={() => setTripId(trip.id)}
              />
            </Col>
          ))}
        </Row>
      )}

      {creating && (
        <CreateTripModal
          orders={chosen}
          onClose={() => setCreating(false)}
          onCreated={(id, failed) => {
            setCreating(false)
            setSelected([])
            setTripId(id)
            if (!failed.length) {
              message.success(`Đã tạo chuyến #${id} với ${chosen.length} đơn.`)
              return
            }
            modal.warning({
              title: `Đã tạo chuyến #${id}, còn ${failed.length}/${chosen.length} đơn chưa thêm được`,
              content: (
                <ul className="af-bulk-errors">
                  {failed.map(({ item, error }) => (
                    <li key={item.id}>
                      <strong>{item.code}</strong>: {error}
                    </li>
                  ))}
                </ul>
              ),
            })
          }}
        />
      )}
      {tripId !== null && <TripDrawer key={tripId} tripId={tripId} onClose={() => setTripId(null)} />}
    </>
  )
}
