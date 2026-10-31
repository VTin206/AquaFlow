import { useEffect, useState } from 'react'
import { Alert, Button, Card, Empty, Progress, Select, Skeleton, Tag } from 'antd'
import { Clock3, Map, Package, Phone, Recycle, Wallet } from 'lucide-react'
import { useStaff } from '@/features/auth/useStaff'
import { QueryError } from '@/shared/components/QueryError'
import { Money } from '@/shared/components/Money'
import { dueTone } from '@/shared/utils/money'
import { AdvanceStatusButton } from '@/features/orders/components/AdvanceStatusButton'
import { OrderDetailsModal } from '@/features/orders/components/OrderDetailsModal'
import { LateTag } from '@/features/orders/components/LateTag'
import { OrderStatusTag } from '@/features/orders/components/OrderStatusTag'
import { amountDue, deliveryAttempts, jugCount, type Order } from '@/features/orders/types'
import { useOrders } from '@/features/orders/useOrders'
import { TripStatusTag } from './components/TripStatusTag'
import { drivers, type Trip } from './types'
import { dispatchedIn, openIn } from './tripService'
import { useTrips } from './useTrips'

const DRIVER_KEY = 'aquaflow.driver'
const readDriver = () => {
  try {
    const saved = localStorage.getItem(DRIVER_KEY)
    return saved && drivers.includes(saved) ? saved : drivers[0]
  } catch {
    return drivers[0]
  }
}

const mapsUrl = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`

/** Màn hình điện thoại cho tài xế: chỉ chuyến của mình, nút gọi/chỉ đường lớn, ghi kết quả từng điểm. */
export function DriverPage() {
  const staff = useStaff()
  const [chosen, setDriver] = useState(readDriver)
  // Tài khoản giao hàng chỉ xem chuyến của chính mình; chủ cửa hàng chọn tài xế để xem thay.
  const ownTrips = staff?.role === 'DELIVERY_STAFF'
  const driver = ownTrips ? staff.name : chosen
  const tripsQuery = useTrips()
  const ordersQuery = useOrders()
  const [orderId, setOrderId] = useState<string | null>(null)
  const orders = ordersQuery.data ?? []
  const myTrips = (tripsQuery.data ?? []).filter((trip) => trip.driver === driver && trip.status !== 'Đã đối soát')

  useEffect(() => {
    document.title = 'Chuyến của tôi | AquaFlow'
  }, [])

  const chooseDriver = (value: string) => {
    setDriver(value)
    try {
      localStorage.setItem(DRIVER_KEY, value)
    } catch {
      // Không lưu được thì lần sau chọn lại.
    }
  }

  return (
    <>
      <div className="af-driver">
        <header className="af-driver-head">
          <h1>Chuyến của tôi</h1>
          {ownTrips && (
            <p>
              {driver} · {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })}
            </p>
          )}
        </header>
        {!ownTrips && (
          <>
            <label className="af-driver-picker">
              <span>Tài xế</span>
              <Select value={driver} onChange={chooseDriver} options={drivers.map((name) => ({ value: name, label: name }))} />
            </label>
            <p className="af-form-hint">Đang xem thay tài xế. Nhân viên giao hàng đăng nhập sẽ chỉ thấy chuyến của mình.</p>
          </>
        )}

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
              onDetails={setOrderId}
            />
          ))
        )}
      </div>
      {orderId && <OrderDetailsModal key={orderId} orderId={orderId} onClose={() => setOrderId(null)} />}
    </>
  )
}

function DriverTrip({ trip, stops, onDetails }: { trip: Trip; stops: Order[]; onDetails: (id: string) => void }) {
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
        {/* Tài xế không xuất kho: cửa hàng Dispatch ở trang Giao hàng, xong mới đi giao. */}
        {waiting > 0 && (
          <Alert
            type="info"
            showIcon
            title={`${waiting} đơn chờ cửa hàng xuất kho`}
            description="Nhận hàng tại cửa hàng sau khi nhân viên xuất kho cho chuyến."
          />
        )}
        {trip.status === 'Chờ đối soát' && (
          <p className="af-driver-done">Đã giao hết các điểm. Về cửa hàng bàn giao tiền và vỏ để đối soát.</p>
        )}
      </Card>

      <ol className="af-driver-stops">
        {pending.map((order, index) => (
          <li key={order.id} className="af-driver-stop">
            <div className="af-trip-stop-top">
              <span className="af-trip-stop-index">{index + 1}</span>
              <strong className="af-driver-customer">{order.customer}</strong>
              {dispatchedIn(trip, order) ? <OrderStatusTag status={order.status} method={order.method} /> : <Tag>Chờ xuất kho</Tag>}
              <LateTag order={order} />
            </div>
            <p className="af-driver-address">
              {order.address}
              {order.floor ? ` · lầu ${order.floor} (thang bộ)` : ''}
            </p>
            <ul className="af-driver-facts">
              <li>
                <Package size={15} /> {order.items}
              </li>
              {order.appointment && (
                <li>
                  <Clock3 size={15} /> Hẹn {new Date(order.appointment).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </li>
              )}
              <li>
                <Wallet size={15} /> Thu <Money value={amountDue(order)} tone={dueTone(amountDue(order))} />
                {jugCount(order) ? ` · đổi ${jugCount(order)} vỏ` : ''}
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
              <Button size="large" icon={<Map size={18} />} href={mapsUrl(order.address)} target="_blank" rel="noreferrer">
                Chỉ đường
              </Button>
              <Button size="large" onClick={() => onDetails(order.id)}>
                Thu tiền
              </Button>
              {order.status === 'Đang giao' && (
                <span className="af-driver-result">
                  <AdvanceStatusButton order={order} />
                </span>
              )}
            </div>
          </li>
        ))}
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
