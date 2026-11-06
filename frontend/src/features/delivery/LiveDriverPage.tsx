import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Card, Empty, Form, InputNumber, Modal, Popconfirm, Progress, Segmented, Skeleton, Tag } from 'antd'
import { Clock3, History, Map, Package, Phone, Recycle, RefreshCw, Wallet } from 'lucide-react'
import { TransferQr } from '@/shared/payment/TransferQr'
import { useSettings } from '@/features/settings/settingsService'
import { mapsSearchUrl } from '@/shared/address/maps'
import { useAuth } from '@/features/auth/useAuth'
import { useStaff } from '@/features/auth/useStaff'
import { Money } from '@/shared/components/Money'
import { QueryError } from '@/shared/components/QueryError'
import { currency } from '@/shared/utils/format'
import { dueTone } from '@/shared/utils/money'
import { modalWidth } from '@/shared/utils/modal'
import { invalidateLiveData } from '@/features/live/invalidateLiveData'
import { OrderFocusBanner } from '@/features/orders/components/OrderSheet'
import { collectionApi, deliveryApi, type CollectionInput, type DeliveryStop, type DeliveryTrip, type TripCollections } from './deliveryApi'
import { AttemptsTimeline } from './components/AttemptsTimeline'
import { DeliveryActionModal } from './components/DeliveryActionModal'
import { TripStatusTag } from './components/TripStatusTag'
import { TripRouteButton } from './components/TripRouteButton'
import { DriverDue, driverToday } from './driverParts'
import { driverTripFocus, liveTripStatus } from './tripFocus'

/** Màn hình điện thoại cho tài xế: mỗi chuyến nói rõ việc tiếp theo, điểm chưa giao lên trước. */
export function LiveDriverPage() {
  const { user } = useAuth()
  const staff = useStaff()
  const [showHistory, setShowHistory] = useState(false)
  // BE chỉ trả chuyến của tài xế đang đăng nhập.
  const trips = useQuery({ queryKey: ['live', 'driver-trips', user?.email], queryFn: deliveryApi.list, refetchInterval: 15000 })
  const finished = (trip: DeliveryTrip) => ['COMPLETED', 'CANCELLED'].includes(trip.status)
  const mine = trips.data ?? []
  const visible = mine.filter((trip) => showHistory || !finished(trip))
  const hiddenCount = mine.filter(finished).length
  return (
    <div className="af-driver">
      <header className="af-driver-head">
        <div>
          <h1>Chuyến của tôi</h1>
          <p>
            {staff?.name} · {driverToday()}
          </p>
        </div>
        {/* Trang tự làm mới 15 giây một lần; nút này để lấy ngay đơn cửa hàng vừa xếp thêm. */}
        <Button icon={<RefreshCw size={16} />} loading={trips.isFetching} onClick={() => void trips.refetch()}>
          Làm mới
        </Button>
      </header>
      {trips.isError ? (
        <QueryError error={trips.error} onRetry={trips.refetch} />
      ) : trips.isPending ? (
        <Skeleton active />
      ) : !visible.length ? (
        <Card>
          <Empty description="Chưa có chuyến nào được giao cho bạn." />
        </Card>
      ) : (
        visible.map((trip) => <DriverTrip key={trip.id} trip={trip} />)
      )}
      {hiddenCount > 0 && (
        <Button type="link" block onClick={() => setShowHistory(!showHistory)}>
          {showHistory ? 'Ẩn chuyến đã xong' : `Xem ${hiddenCount} chuyến đã xong`}
        </Button>
      )}
    </div>
  )
}

function DriverTrip({ trip }: { trip: DeliveryTrip }) {
  const { user } = useAuth()
  const { message } = App.useApp()
  const client = useQueryClient()
  const [result, setResult] = useState<DeliveryStop | null>(null)
  const [collect, setCollect] = useState<DeliveryStop | null>(null)
  const [history, setHistory] = useState<DeliveryStop | null>(null)
  const receipts = useQuery({
    queryKey: ['live', 'trip-collections', user?.email, trip.id],
    queryFn: () => collectionApi.get(trip.id),
    refetchInterval: 15000,
  })
  const attempts = useQuery({
    queryKey: ['live', 'driver-attempts', user?.email, trip.id, history?.orderId],
    queryFn: () => deliveryApi.assignmentAttempts(history!.id),
    enabled: !!history,
  })
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
  // Chỉ tính trước khi khởi hành: sau đó đơn đổi sang đã giao là bình thường, không phải chờ xuất kho.
  const waitingForDispatch = trip.status === 'CREATED' ? trip.orders.filter((order) => order.orderStatus !== 'OUT_FOR_DELIVERY').length : 0
  const canDepart = trip.status === 'CREATED' && trip.orders.length > 0 && Boolean(trip.driverId) && waitingForDispatch === 0
  const stage = trip.status === 'CREATED' ? 'preparing' : active ? 'delivering' : trip.status === 'COMPLETED' ? 'settled' : 'cancelled'
  const totalDue = receipts.data?.balances.reduce((sum, balance) => sum + balance.due, 0) ?? 0
  const totalBottles = receipts.data?.balances.reduce((sum, balance) => sum + balance.bottlesToExchange, 0) ?? 0

  const stop = (order: DeliveryStop, index: number, list: DeliveryStop[]) => {
    const balance = receipts.data?.balances.find((b) => b.orderId === order.orderId)
    const returned = receipts.data?.receipts.filter((r) => r.orderId === order.orderId).reduce((sum, r) => sum + r.bottlesReturned, 0) ?? 0
    return (
      <li className="af-driver-stop" key={order.id}>
        <div className="af-trip-stop-top">
          {list === pending && <span className="af-trip-stop-index">{index + 1}</span>}
          <strong className="af-driver-customer">{order.recipientName || 'Khách hàng'}</strong>
          {/* Cả chuyến đang giao thì không lặp lại thẻ "Đang giao" ở từng điểm. */}
          {(order.latestAttempt || !active) && (
            <Tag color={order.latestAttempt?.outcome === 'SUCCESS' ? 'green' : order.latestAttempt ? 'red' : 'default'}>
              {order.latestAttempt?.outcome === 'SUCCESS'
                ? 'Đã giao'
                : order.latestAttempt
                  ? 'Giao thất bại'
                  : order.orderStatus === 'PREPARING'
                    ? 'Chờ xuất kho'
                    : 'Chờ khởi hành'}
            </Tag>
          )}
        </div>
        <small className="af-text-muted">{order.orderCode}</small>
        {order.deliveryAddress && <p className="af-driver-address">{order.deliveryAddress}</p>}
        <ul className="af-driver-facts">
          {order.items.map((line, i) => (
            <li key={i}>
              <Package size={15} />
              <span>
                {line.productName} × {line.quantity} {line.unit.toLowerCase()}
              </span>
            </li>
          ))}
          {order.recipientPhone && (
            <li>
              <Phone size={15} />
              <a href={`tel:${order.recipientPhone}`}>{order.recipientPhone}</a>
            </li>
          )}
          {order.requestedDeliveryAt && (
            <li>
              <Clock3 size={15} />
              <span>
                Hẹn{' '}
                {new Date(order.requestedDeliveryAt).toLocaleString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  day: '2-digit',
                  month: '2-digit',
                })}
              </span>
            </li>
          )}
          {balance && (
            <li>
              <Wallet size={15} />
              <span>
                <DriverDue due={balance.due} />
                {balance.bottlesToExchange > 0 && ` · đổi ${balance.bottlesToExchange} vỏ, đã nhận ${returned}`}
              </span>
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
            <Button size="large" icon={<Map size={18} />} href={mapsSearchUrl(order.deliveryAddress)} target="_blank" rel="noreferrer">
              Chỉ đường
            </Button>
          )}
          {active && (
            <Button
              size="large"
              icon={<Wallet size={18} />}
              disabled={!receipts.data || change.isPending || (!!balance && balance.due <= 0 && balance.bottlesToExchange <= returned)}
              onClick={() => setCollect(order)}
            >
              Thu tiền
            </Button>
          )}
          {order.latestAttempt && (
            <Button size="large" icon={<History size={18} />} onClick={() => setHistory(order)}>
              Lịch sử
            </Button>
          )}
          {active && !order.latestAttempt && (
            <Button size="large" type="primary" className="af-driver-primary" disabled={change.isPending} onClick={() => setResult(order)}>
              Kết quả giao
            </Button>
          )}
        </div>
      </li>
    )
  }

  return (
    <section className="af-driver-trip" aria-label={`Chuyến ${trip.id}`}>
      <Card size="small" className="af-driver-summary">
        <div className="af-trip-card-head">
          <strong>Chuyến #{trip.id}</strong>
          <TripStatusTag status={liveTripStatus(trip)} />
        </div>
        <Progress
          percent={Math.round((done / Math.max(1, trip.orders.length)) * 100)}
          format={() => `${done}/${trip.orders.length} điểm`}
        />
        {receipts.data && (
          <div className="af-driver-totals">
            <span>
              <Wallet size={16} /> Cần thu <Money value={totalDue} tone={dueTone(totalDue)} />
            </span>
            <span>
              <Recycle size={16} /> Vỏ cần đổi <strong>{totalBottles}</strong>
            </span>
            {(receipts.data.cashExpected > 0 || receipts.data.bottlesExpected > 0) && (
              <span>
                Đang giữ <strong>{currency(receipts.data.cashExpected)}</strong> · <strong>{receipts.data.bottlesExpected}</strong> vỏ
              </span>
            )}
          </div>
        )}
        {receipts.isError && <QueryError error={receipts.error} onRetry={receipts.refetch} />}
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
        {active && pending.length > 0 && (
          <TripRouteButton
            size="large"
            block
            label="Xem lộ trình các điểm còn lại"
            addresses={pending.map((order) => order.deliveryAddress)}
          />
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
      {collect && receipts.data && (
        <CollectionModal
          order={collect}
          data={receipts.data}
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
      <Modal open={!!history} centered title={`Lịch sử ${history?.orderCode ?? ''}`} onCancel={() => setHistory(null)} footer={null}>
        {attempts.isError ? (
          <QueryError error={attempts.error} onRetry={attempts.refetch} />
        ) : attempts.isPending ? (
          <Skeleton active />
        ) : (
          <AttemptsTimeline attempts={attempts.data} />
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
  const method = Form.useWatch('method', form)
  const amount: number | undefined = Form.useWatch('amount', form)
  const { data: settings } = useSettings()
  return (
    <Modal
      open
      centered
      title={`Thu tiền / nhận vỏ · ${order.orderCode}`}
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
      <p>Còn phải thu: {currency(balance.due)}. Chỉ ghi nhận tiền và vỏ đã nhận thực tế.</p>
      <Form
        form={form}
        layout="vertical"
        disabled={loading}
        initialValues={{ amount: balance.due, method: 'CASH', bottlesReturned: 0 }}
        onFinish={(values) => onSave({ ...values, requestId })}
      >
        <Form.Item name="amount" label="Số tiền nhận" rules={[{ required: true }, { type: 'number', min: 0, max: balance.due }]}>
          <InputNumber
            min={0}
            max={balance.due}
            precision={0}
            inputMode="numeric"
            formatter={(value) => `${value ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
            parser={(value) => Number((value ?? '').replace(/\D/g, ''))}
            suffix="₫"
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item name="method" label="Phương thức" rules={[{ required: true }]}>
          <Segmented
            block
            options={[
              { value: 'CASH', label: 'Tiền mặt' },
              { value: 'BANK_TRANSFER', label: 'Chuyển khoản' },
            ]}
          />
        </Form.Item>
        {method === 'BANK_TRANSFER' && (
          <div className="af-driver-qr">
            <TransferQr settings={settings} amount={amount && amount > 0 ? amount : balance.due} note={order.orderCode} />
            <p className="af-form-hint">Đưa mã cho khách quét. Chỉ bấm Ghi nhận sau khi thấy tiền vào tài khoản cửa hàng.</p>
          </div>
        )}
        <Form.Item
          name="bottlesReturned"
          label="Số vỏ đã nhận"
          rules={[{ required: true }, { type: 'integer', min: 0, max: balance.bottlesToExchange }]}
        >
          <InputNumber min={0} max={balance.bottlesToExchange} precision={0} inputMode="numeric" suffix="vỏ" style={{ width: '100%' }} />
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
