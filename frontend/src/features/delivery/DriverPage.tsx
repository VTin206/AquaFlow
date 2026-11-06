import { useEffect, useState } from 'react'
import { Button, Card, Empty, Progress, Skeleton, Tag } from 'antd'
import { Clock3, Map, Package, Phone, Recycle, Wallet } from 'lucide-react'
import { mapsSearchUrl } from '@/shared/address/maps'
import { useStaff } from '@/features/auth/useStaff'
import { QueryError } from '@/shared/components/QueryError'
import { Money } from '@/shared/components/Money'
import { dueTone } from '@/shared/utils/money'
import { AdvanceStatusButton } from '@/features/orders/components/AdvanceStatusButton'
import { OrderDetailsModal } from '@/features/orders/components/OrderDetailsModal'
import { LateTag } from '@/features/orders/components/LateTag'
import { OrderFocusBanner } from '@/features/orders/components/OrderSheet'
import { OrderStatusTag } from '@/features/orders/components/OrderStatusTag'
import { amountDue, deliveryAttempts, jugCount, type Order } from '@/features/orders/types'
import { useOrders } from '@/features/orders/useOrders'
import { TripRouteButton } from './components/TripRouteButton'
import { TripStatusTag } from './components/TripStatusTag'
import type { Trip } from './types'
import { driverTripFocus } from './tripFocus'
import { dispatchedIn, openIn } from './tripService'
import { useTrips } from './useTrips'
import { useIsDemo } from '@/shared/features'
import { LiveDriverPage } from './LiveDriverPage'
import { DriverDue, driverToday } from './driverParts'

/** Màn hình điện thoại cho tài xế: chỉ chuyến của mình, nút gọi/chỉ đường lớn, ghi kết quả từng điểm. */
export function DriverPage() {
  return useIsDemo() ? <DemoDriverPage /> : <LiveDriverPage />
}

function DemoDriverPage() {
  const staff = useStaff()
  const tripsQuery = useTrips()
  const ordersQuery = useOrders()
  const [payingId, setPayingId] = useState<string | null>(null)
  const orders = ordersQuery.data ?? []
  const myTrips = (tripsQuery.data ?? []).filter((trip) => trip.driver === staff?.name && trip.status !== 'Đã đối soát')

  useEffect(() => {
    document.title = 'Chuyến của tôi | AquaFlow'
  }, [])

  return (
    <>
      <div className="af-driver">
        <header className="af-driver-head">
          <h1>Chuyến của tôi</h1>
          <p>
            {staff?.name} · {driverToday()}
          </p>
        </header>

        {tripsQuery.isError || ordersQuery.isError ? (
          <Card>
            <QueryError
              error={(tripsQuery.error ?? ordersQuery.error)!}
              onRetry={() => {
                tripsQuery.refetch()
                ordersQuery.refetch()
              }}
            />
          </Card>
        ) : tripsQuery.isPending || ordersQuery.isPending ? (
          <Skeleton active />
        ) : myTrips.length === 0 ? (
          <Card>
            <Empty description="Chưa có chuyến nào được giao cho bạn." />
          </Card>
        ) : (
          myTrips.map((trip) => (
            <DriverTrip
              key={trip.id}
              trip={trip}
              stops={trip.orderIds.map((id) => orders.find((order) => order.id === id)).filter((order) => order !== undefined)}
              onCollect={setPayingId}
            />
          ))
        )}
      </div>
      {payingId && <OrderDetailsModal key={payingId} orderId={payingId} payOnly onClose={() => setPayingId(null)} />}
    </>
  )
}

function DriverTrip({ trip, stops, onCollect }: { trip: Trip; stops: Order[]; onCollect: (id: string) => void }) {
  const pending = stops.filter((order) => openIn(trip, order))
  const finished = stops.filter((order) => !openIn(trip, order))
  const waiting = pending.filter((order) => !dispatchedIn(trip, order)).length
  const due = stops.reduce((sum, order) => sum + amountDue(order), 0)
  const jugs = stops.reduce((sum, order) => sum + jugCount(order), 0)

  return (
    <section className="af-driver-trip" aria-label={`Chuyến ${trip.id}`}>
      <Card size="small" className="af-driver-summary">
        <div className="af-trip-card-head">
          <strong>Chuyến {trip.id}</strong>
          <TripStatusTag status={trip.status} />
        </div>
        <Progress
          percent={Math.round((finished.length / Math.max(1, stops.length)) * 100)}
          format={() => `${finished.length}/${stops.length} điểm`}
        />
        <div className="af-driver-totals">
          <span>
            <Wallet size={16} /> Cần thu <Money value={due} tone={dueTone(due)} />
          </span>
          <span>
            <Recycle size={16} /> Vỏ cần đổi <strong>{jugs}</strong>
          </span>
        </div>
        {/* Tài xế không xuất kho: cửa hàng xuất kho ở trang Giao hàng, xong mới đi giao. */}
        <OrderFocusBanner
          focus={driverTripFocus({
            stage: 'delivering',
            total: stops.length,
            pending: pending.length,
            waitingDispatch: waiting,
            nextCustomer: pending[0]?.customer,
          })}
        />
        <TripRouteButton
          size="large"
          block
          label="Xem lộ trình các điểm còn lại"
          addresses={pending.map((order) => [order.address, order.area].filter(Boolean).join(', '))}
        />
      </Card>

      <ol className="af-driver-stops">
        {pending.map((order, index) => {
          const orderDue = amountDue(order)
          return (
            <li key={order.id} className="af-driver-stop">
              <div className="af-trip-stop-top">
                <span className="af-trip-stop-index">{index + 1}</span>
                <strong className="af-driver-customer">{order.customer}</strong>
                {/* Cả chuyến đang giao thì không lặp lại thẻ "Đang giao" ở từng điểm. */}
                {!dispatchedIn(trip, order) ? (
                  <Tag>Chờ xuất kho</Tag>
                ) : (
                  order.status !== 'Đang giao' && <OrderStatusTag status={order.status} method={order.method} />
                )}
                <LateTag order={order} />
              </div>
              <small className="af-text-muted">{order.id}</small>
              <p className="af-driver-address">
                {order.address}
                {order.floor ? ` · lầu ${order.floor} (thang bộ)` : ''}
              </p>
              <ul className="af-driver-facts">
                <li>
                  <Package size={15} />
                  <span>{order.items}</span>
                </li>
                {order.appointment && (
                  <li>
                    <Clock3 size={15} />
                    <span>Hẹn {new Date(order.appointment).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                  </li>
                )}
                <li>
                  <Wallet size={15} />
                  <span>
                    <DriverDue due={orderDue} />
                    {jugCount(order) ? ` · đổi ${jugCount(order)} vỏ` : ''}
                  </span>
                </li>
                {order.note && <li className="af-driver-note">{order.note}</li>}
                {deliveryAttempts(order)
                  .filter((attempt) => !attempt.success)
                  .map((attempt) => (
                    <li key={attempt.at} className="af-text-danger">
                      Lần trước thất bại ({new Date(attempt.at).toLocaleDateString('vi-VN')}): {attempt.reason}
                    </li>
                  ))}
              </ul>
              <div className="af-driver-actions">
                {order.phone && (
                  <Button size="large" icon={<Phone size={18} />} href={`tel:${order.phone.replace(/\s/g, '')}`}>
                    Gọi
                  </Button>
                )}
                <Button
                  size="large"
                  icon={<Map size={18} />}
                  href={mapsSearchUrl([order.address, order.area].filter(Boolean).join(', '))}
                  target="_blank"
                  rel="noreferrer"
                >
                  Chỉ đường
                </Button>
                <Button size="large" icon={<Wallet size={18} />} disabled={orderDue <= 0} onClick={() => onCollect(order.id)}>
                  Thu tiền
                </Button>
                {order.status === 'Đang giao' && (
                  <span className="af-driver-result">
                    <AdvanceStatusButton order={order} size="large" primary />
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {finished.length > 0 && (
        <details className="af-driver-finished">
          <summary>Đã xong {finished.length} điểm</summary>
          <ul>
            {finished.map((order) => (
              <li key={order.id}>
                <span>
                  {order.id} · {order.customer}
                </span>
                {order.status === 'Giao thất bại' ? <Tag color="red">Thất bại</Tag> : <Tag color="green">Đã giao</Tag>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
