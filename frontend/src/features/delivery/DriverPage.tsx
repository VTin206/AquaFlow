import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Card, Empty, Form, InputNumber, Modal, Popconfirm, Progress, Select, Skeleton, Tag } from 'antd'
import { Clock3, Map, Package, Phone, Recycle, Wallet } from 'lucide-react'
import { mapsSearchUrl } from '@/shared/address/maps'
import { useAuth } from '@/features/auth/useAuth'
import { useStaff } from '@/features/auth/useStaff'
import { Money } from '@/shared/components/Money'
import { QueryError } from '@/shared/components/QueryError'
import { useIsDemo } from '@/shared/features'
import { currency } from '@/shared/utils/format'
import { dueTone } from '@/shared/utils/money'
import { modalWidth } from '@/shared/utils/modal'
import { invalidateLiveData } from '@/features/live/invalidateLiveData'
import { AdvanceStatusButton } from '@/features/orders/components/AdvanceStatusButton'
import { OrderDetailsModal } from '@/features/orders/components/OrderDetailsModal'
import { OrderFocusBanner } from '@/features/orders/components/OrderSheet'
import type { Order } from '@/features/orders/types'
import { useOrders } from '@/features/orders/useOrders'
import {
  collectionApi,
  deliveryApi,
  type CollectionInput,
  type DeliveryAttempt,
  type DeliveryStop,
  type DeliveryTrip,
  type TripCollections,
} from './deliveryApi'
import { DeliveryBottlesButton } from './components/DeliveryBottlesButton'
import { AttemptsTimeline } from './components/AttemptsTimeline'
import { DeliveryActionModal } from './components/DeliveryActionModal'
import { TripStatusTag } from './components/TripStatusTag'
import { demoAttempts, demoCollections, demoDrivers, toDriverTrip } from './demoDriverData'
import { driverTripFocus, liveTripStatus } from './tripFocus'
import { useTrips } from './useTrips'

/** Nguồn dữ liệu mẫu cho một màn hình tài xế; không có thì màn hình gọi API thật. */
type DemoTools = {
  collections: (tripId: number) => TripCollections | undefined
  attempts: (stop: DeliveryStop) => DeliveryAttempt[]
  orderOf: (stop: DeliveryStop) => Order | undefined
  openDetails: (stop: DeliveryStop) => void
}

/** Màn hình tài xế dùng chung: chỗ này chỉ chọn nguồn dữ liệu, giao diện nằm ở DriverScreen. */
export function DriverPage() {
  return useIsDemo() ? <DemoDriver /> : <LiveDriver />
}

function LiveDriver() {
  const { user } = useAuth()
  const staff = useStaff()
  const trips = useQuery({ queryKey: ['live', 'driver-trips', user?.email], queryFn: deliveryApi.list, refetchInterval: 15000 })
  const drivers = useQuery({
    queryKey: ['live', 'driver-options', user?.email],
    queryFn: deliveryApi.drivers,
    enabled: staff?.role === 'ADMIN',
  })
  return (
    <DriverScreen
      trips={trips.data}
      loading={trips.isPending}
      error={trips.isError ? trips.error : null}
      onRetry={() => void trips.refetch()}
      drivers={drivers.data}
    />
  )
}

function DemoDriver() {
  const staff = useStaff()
  const tripsQuery = useTrips()
  const ordersQuery = useOrders()
  const [detailsId, setDetailsId] = useState<string | null>(null)
  const orders = ordersQuery.data ?? []
  // Tài khoản giao hàng chỉ xem chuyến của chính mình; chủ cửa hàng chọn tài xế để xem thay.
  const records = (tripsQuery.data ?? []).filter((trip) => staff?.role !== 'DELIVERY_STAFF' || trip.driver === staff.name)
  const stopsOf = (ids: string[]) => ids.map((id) => orders.find((order) => order.id === id)).filter((order) => order !== undefined)
  const trips = records.map((trip, index) => toDriverTrip(trip, stopsOf(trip.orderIds), index))
  const orderOf = (stop: DeliveryStop) => orders.find((order) => (order.code ?? order.id) === stop.orderCode)
  const tools: DemoTools = {
    collections: (tripId) => {
      const index = trips.findIndex((trip) => trip.id === tripId)
      return index < 0 ? undefined : demoCollections(records[index], stopsOf(records[index].orderIds))
    },
    attempts: (stop) => {
      const order = orderOf(stop)
      return order ? demoAttempts(order) : []
    },
    orderOf,
    openDetails: (stop) => setDetailsId(orderOf(stop)?.id ?? null),
  }
  const error = tripsQuery.error ?? ordersQuery.error
  return (
    <>
      <DriverScreen
        trips={tripsQuery.data && ordersQuery.data ? trips : undefined}
        loading={tripsQuery.isPending || ordersQuery.isPending}
        error={error}
        onRetry={() => {
          void tripsQuery.refetch()
          void ordersQuery.refetch()
        }}
        drivers={demoDrivers}
        demo={tools}
      />
      {detailsId && <OrderDetailsModal key={detailsId} orderId={detailsId} onClose={() => setDetailsId(null)} />}
    </>
  )
}

/** Màn hình điện thoại cho tài xế: mỗi chuyến nói rõ việc tiếp theo, điểm chưa giao lên trước. */
function DriverScreen({
  trips,
  loading,
  error,
  onRetry,
  drivers,
  demo,
}: {
  trips?: DeliveryTrip[]
  loading: boolean
  error: Error | null
  onRetry: () => void
  drivers?: { id: number; name: string }[]
  demo?: DemoTools
}) {
  const staff = useStaff()
  const [driver, setDriver] = useState<number | undefined>()
  const [showHistory, setShowHistory] = useState(false)
  const viewingForOthers = staff?.role === 'ADMIN'
  const finished = (trip: DeliveryTrip) => ['COMPLETED', 'CANCELLED'].includes(trip.status)
  const mine = (trips ?? []).filter((trip) => !driver || trip.driverId === driver)
  const visible = mine.filter((trip) => showHistory || !finished(trip))
  const hiddenCount = mine.filter(finished).length

  useEffect(() => {
    document.title = 'Chuyến của tôi | AquaFlow'
  }, [])

  return (
    <div className="af-driver">
      <header className="af-driver-head">
        <h1>Chuyến của tôi</h1>
        {!viewingForOthers && (
          <p>
            {staff?.name} · {new Date().toLocaleDateString('vi-VN')}
          </p>
        )}
      </header>
      {viewingForOthers && (
        <>
          <label className="af-driver-picker">
            <span>Tài xế</span>
            <Select
              allowClear
              placeholder="Tất cả tài xế"
              value={driver}
              onChange={setDriver}
              options={drivers?.map((d) => ({ value: d.id, label: d.name }))}
            />
          </label>
          <p className="af-form-hint">Đang xem thay tài xế. Nhân viên giao hàng đăng nhập sẽ chỉ thấy chuyến của mình.</p>
        </>
      )}
      {error ? (
        <QueryError error={error} onRetry={onRetry} />
      ) : loading ? (
        <Skeleton active />
      ) : !visible.length ? (
        <Card>
          <Empty description="Chưa có chuyến nào được giao cho bạn." />
        </Card>
      ) : (
        visible.map((trip) => <DriverTrip key={trip.id} trip={trip} showDriver={viewingForOthers} demo={demo} />)
      )}
      {hiddenCount > 0 && (
        <Button type="link" block onClick={() => setShowHistory(!showHistory)}>
          {showHistory ? 'Ẩn chuyến đã xong' : `Xem ${hiddenCount} chuyến đã xong`}
        </Button>
      )}
    </div>
  )
}

function DriverTrip({ trip, showDriver, demo }: { trip: DeliveryTrip; showDriver: boolean; demo?: DemoTools }) {
  const { user } = useAuth()
  const { message } = App.useApp()
  const client = useQueryClient()
  const [result, setResult] = useState<DeliveryStop | null>(null)
  const [collect, setCollect] = useState<DeliveryStop | null>(null)
  const [history, setHistory] = useState<DeliveryStop | null>(null)
  const liveReceipts = useQuery({
    queryKey: ['live', 'trip-collections', user?.email, trip.id],
    queryFn: () => collectionApi.get(trip.id),
    refetchInterval: 15000,
    enabled: !demo,
  })
  const liveAttempts = useQuery({
    queryKey: ['live', 'driver-attempts', user?.email, trip.id, history?.orderId],
    queryFn: () => deliveryApi.assignmentAttempts(history!.id),
    enabled: !demo && !!history,
  })
  const receipts = demo ? demo.collections(trip.id) : liveReceipts.data
  const attempts = demo && history ? demo.attempts(history) : liveAttempts.data
  const change = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: async () => {
      await invalidateLiveData(client)
      message.success('Đã ghi nhận.')
      setResult(null)
      setCollect(null)
    },
    onError: (error) => message.error(error.message),
  })
  const pending = trip.orders.filter((order) => !order.latestAttempt)
  const done = trip.orders.length - pending.length
  const active = trip.status === 'IN_PROGRESS'
  // Trước khi khởi hành: đơn phải ở trạng thái đang giao. Sau đó đơn đổi sang đã giao là bình thường, chỉ đếm đơn còn chờ xuất kho.
  const waitingForDispatch =
    trip.status === 'CREATED'
      ? trip.orders.filter((order) => order.orderStatus !== 'OUT_FOR_DELIVERY').length
      : pending.filter((order) => order.orderStatus === 'PREPARING').length
  const canDepart = trip.status === 'CREATED' && trip.orders.length > 0 && Boolean(trip.driverId) && waitingForDispatch === 0
  const stage = trip.status === 'CREATED' ? 'preparing' : active ? 'delivering' : trip.status === 'COMPLETED' ? 'settled' : 'cancelled'
  const totalDue = receipts?.balances.reduce((sum, balance) => sum + balance.due, 0) ?? 0
  const totalBottles = receipts?.balances.reduce((sum, balance) => sum + balance.bottlesToExchange, 0) ?? 0

  const stop = (order: DeliveryStop, index: number, list: DeliveryStop[]) => {
    const balance = receipts?.balances.find((b) => b.orderId === order.orderId)
    const returned = receipts?.receipts.filter((r) => r.orderId === order.orderId).reduce((sum, r) => sum + r.bottlesReturned, 0) ?? 0
    const demoOrder = demo?.orderOf(order)
    const onTheWay = active && order.orderStatus !== 'PREPARING'
    return (
      <li className="af-driver-stop" key={order.id}>
        <div className="af-trip-stop-top">
          {list === pending && <span className="af-trip-stop-index">{index + 1}</span>}
          <strong className="af-driver-customer">{order.recipientName || 'Khách hàng'}</strong>
          <Tag color={order.latestAttempt?.outcome === 'SUCCESS' ? 'green' : order.latestAttempt ? 'red' : onTheWay ? 'cyan' : 'default'}>
            {order.latestAttempt?.outcome === 'SUCCESS'
              ? 'Đã giao'
              : order.latestAttempt
                ? 'Giao thất bại'
                : onTheWay
                  ? 'Đang giao'
                  : order.orderStatus === 'PREPARING'
                    ? 'Chờ xuất kho'
                    : 'Chờ khởi hành'}
          </Tag>
        </div>
        <small className="af-text-muted">{order.orderCode}</small>
        {order.deliveryAddress && <p className="af-driver-address">{order.deliveryAddress}</p>}
        <ul className="af-driver-facts">
          {order.items.map((line, i) => (
            <li key={i}>
              <Package size={15} /> {line.productName} × {line.quantity} {line.unit.toLowerCase()}
            </li>
          ))}
          {order.requestedDeliveryAt && (
            <li>
              <Clock3 size={15} /> Hẹn {new Date(order.requestedDeliveryAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
            </li>
          )}
          {balance && (
            <li>
              <Wallet size={15} /> Thu <Money value={balance.due} tone={dueTone(balance.due)} />
              {balance.bottlesToExchange > 0 && ` · đổi ${balance.bottlesToExchange} vỏ, đã nhận ${returned}`}
            </li>
          )}
          {order.note && <li className="af-driver-note">{order.note}</li>}
          {order.latestAttempt?.failureReason && <li className="af-text-danger">Lý do thất bại: {order.latestAttempt.failureReason}</li>}
        </ul>
        <div className="af-driver-actions">
          {order.recipientPhone && (
            <Button size="large" icon={<Phone size={18} />} href={`tel:${order.recipientPhone}`}>
              Gọi
            </Button>
          )}
          {order.deliveryAddress && (
            <Button
              size="large"
              icon={<Map size={18} />}
              href={mapsSearchUrl(order.deliveryAddress)}
              target="_blank"
              rel="noreferrer"
            >
              Chỉ đường
            </Button>
          )}
          {active && (
            <Button
              size="large"
              disabled={!balance || balance.due <= 0 || change.isPending}
              onClick={() => (demo ? demo.openDetails(order) : setCollect(order))}
            >
              Thu tiền
            </Button>
          )}
          {order.latestAttempt && (
            <Button size="large" onClick={() => setHistory(order)}>
              Lịch sử giao
            </Button>
          )}
          {demo ? <Button disabled>Vỏ của đơn (chưa hỗ trợ)</Button> : <DeliveryBottlesButton assignmentId={order.id} orderCode={order.orderCode} />}
          {active &&
            !order.latestAttempt &&
            (demoOrder ? (
              demoOrder.status === 'Đang giao' && (
                <span className="af-driver-result">
                  <AdvanceStatusButton order={demoOrder} size="large" primary />
                </span>
              )
            ) : (
              <Button size="large" type="primary" className="af-driver-primary" disabled={change.isPending} onClick={() => setResult(order)}>
                Ghi kết quả giao
              </Button>
            ))}
        </div>
      </li>
    )
  }

  return (
    <section className="af-driver-trip" aria-label={`Chuyến ${trip.id}`}>
      <Card size="small" className="af-driver-summary">
        <div className="af-trip-card-head">
          <strong>
            Chuyến #{trip.id}
            {showDriver && trip.driverName ? ` · ${trip.driverName}` : ''}
          </strong>
          <TripStatusTag status={liveTripStatus(trip)} />
        </div>
        <Progress percent={Math.round((done / Math.max(1, trip.orders.length)) * 100)} format={() => `${done}/${trip.orders.length} điểm`} />
        {receipts && (
          <div className="af-driver-totals">
            <span>
              <Wallet size={16} /> Cần thu <Money value={totalDue} tone={dueTone(totalDue)} />
            </span>
            <span>
              <Recycle size={16} /> Vỏ cần đổi <strong>{totalBottles}</strong>
            </span>
            {(receipts.cashExpected > 0 || receipts.bottlesExpected > 0) && (
              <span>
                Đang giữ <strong>{currency(receipts.cashExpected)}</strong> · <strong>{receipts.bottlesExpected}</strong> vỏ
              </span>
            )}
          </div>
        )}
        {!demo && liveReceipts.isError && <QueryError error={liveReceipts.error} onRetry={liveReceipts.refetch} />}
        <OrderFocusBanner
          focus={driverTripFocus({
            stage,
            total: trip.orders.length,
            pending: pending.length,
            waitingDispatch: waitingForDispatch,
            nextCustomer: pending[0]?.recipientName || 'Khách hàng',
          })}
        />
        {canDepart && (
          <Popconfirm
            title="Đã nhận đủ hàng và bắt đầu giao?"
            okText="Bắt đầu"
            cancelText="Chưa"
            onConfirm={() => change.mutateAsync(() => deliveryApi.depart(trip.id)).catch(() => {})}
          >
            <Button size="large" type="primary" block loading={change.isPending}>
              Bắt đầu chuyến
            </Button>
          </Popconfirm>
        )}
      </Card>
      {pending.length > 0 && <ol className="af-driver-stops">{pending.map(stop)}</ol>}
      {done > 0 && (
        <details className="af-driver-finished">
          <summary>Đã có kết quả {done} điểm</summary>
          <ol className="af-driver-stops">{trip.orders.filter((o) => o.latestAttempt).map(stop)}</ol>
        </details>
      )}
      {result && (
        <DeliveryActionModal
          action={{ kind: 'result', tripId: trip.id, order: result }}
          drivers={[]}
          available={[]}
          optionError={null}
          onRetry={() => {}}
          loading={change.isPending}
          onClose={() => setResult(null)}
          onSubmit={async (values) => {
            try {
              await change.mutateAsync(() =>
                deliveryApi.assignmentResult(result.id, {
                  outcome: values.outcome!,
                  recipientName: values.outcome === 'SUCCESS' ? values.recipientName : undefined,
                  failureReason: values.outcome === 'FAILED' ? values.failureReason : undefined,
                  note: values.note,
                }),
              )
            } catch {
              /* Keep draft for retry. */
            }
          }}
        />
      )}
      {collect && receipts && (
        <CollectionModal
          order={collect}
          data={receipts}
          loading={change.isPending}
          onClose={() => setCollect(null)}
          onSave={async (input) => {
            try {
              await change.mutateAsync(() => collectionApi.collect(trip.id, collect.orderId, input))
            } catch {
              /* Keep idempotency key for retry. */
            }
          }}
        />
      )}
      <Modal open={!!history} title={`Lịch sử ${history?.orderCode ?? ''}`} onCancel={() => setHistory(null)} footer={null}>
        {!demo && liveAttempts.isError ? (
          <QueryError error={liveAttempts.error} onRetry={liveAttempts.refetch} />
        ) : attempts ? (
          <AttemptsTimeline attempts={attempts} />
        ) : (
          <Skeleton active />
        )}
      </Modal>
    </section>
  )
}

function CollectionModal({
  order,
  data,
  loading,
  onClose,
  onSave,
}: {
  order: DeliveryStop
  data: TripCollections
  loading: boolean
  onClose: () => void
  onSave: (input: CollectionInput) => Promise<void>
}) {
  const [form] = Form.useForm()
  const [requestId] = useState(() => crypto.randomUUID())
  const balance = data.balances.find((b) => b.orderId === order.orderId)!
  return (
    <Modal
      open
      title={`Thu tiền · ${order.orderCode}`}
      width={modalWidth.small}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={loading}
      closable={!loading}
      maskClosable={!loading}
      cancelButtonProps={{ disabled: loading }}
      okText="Ghi nhận"
      cancelText="Hủy"
    >
      <p>Còn phải thu: {currency(balance.due)}. Chỉ ghi nhận tiền đã nhận thực tế. Thu vỏ theo từng loại tại nút Vỏ của đơn.</p>
      <Form
        form={form}
        layout="vertical"
        disabled={loading}
        initialValues={{ amount: balance.due, method: 'CASH', bottlesReturned: 0 }}
        onFinish={(values) => onSave({ ...values, bottlesReturned: 0, requestId })}
      >
        <Form.Item name="amount" label="Số tiền nhận" rules={[{ required: true }, { type: 'number', min: 0.01, max: balance.due }]}>
          <InputNumber min={0.01} max={balance.due} precision={2} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="method" label="Phương thức" rules={[{ required: true }]}>
          <Select
            options={[
              { value: 'CASH', label: 'Tiền mặt' },
              { value: 'BANK_TRANSFER', label: 'Đã nhận chuyển khoản' },
            ]}
          />
        </Form.Item>
      </Form>
      {data.receipts
        .filter((r) => r.orderId === order.orderId)
        .map((r) => (
          <p key={r.id}>
            {new Date(r.createdAt).toLocaleString('vi-VN')} · {currency(r.amount)} ({r.method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}) ·{' '}
            {r.bottlesReturned} vỏ
          </p>
        ))}
    </Modal>
  )
}
