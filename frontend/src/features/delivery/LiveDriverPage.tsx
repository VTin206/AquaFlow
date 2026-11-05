import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Card, Empty, Form, InputNumber, Modal, Popconfirm, Progress, Select, Skeleton, Space, Tag } from 'antd'
import { Map, Phone, Wallet, Recycle } from 'lucide-react'
import { useAuth } from '@/features/auth/useAuth'
import { useStaff } from '@/features/auth/useStaff'
import { QueryError } from '@/shared/components/QueryError'
import { currency } from '@/shared/utils/format'
import { invalidateLiveData } from '@/features/live/invalidateLiveData'
import {
  collectionApi,
  deliveryApi,
  tripLabels,
  type CollectionInput,
  type DeliveryStop,
  type DeliveryTrip,
  type TripCollections,
} from './deliveryApi'
import { DeliveryActionModal } from './components/DeliveryActionModal'

export function LiveDriverPage() {
  const { user } = useAuth()
  const staff = useStaff()
  const [driver, setDriver] = useState<number | undefined>()
  const [showHistory, setShowHistory] = useState(false)
  const trips = useQuery({ queryKey: ['live', 'driver-trips', user?.email], queryFn: deliveryApi.list, refetchInterval: 15000 })
  const drivers = useQuery({
    queryKey: ['live', 'driver-options', user?.email],
    queryFn: deliveryApi.drivers,
    enabled: staff?.role === 'ADMIN',
  })
  const visible = (trips.data ?? []).filter(
    (t) => (!driver || t.driverId === driver) && (showHistory || !['COMPLETED', 'CANCELLED'].includes(t.status)),
  )
  return (
    <div className="af-driver">
      <header className="af-driver-head">
        <h1>Chuyến của tôi</h1>
        <p>
          {staff?.name} · {new Date().toLocaleDateString('vi-VN')}
        </p>
      </header>
      <Space wrap style={{ marginBottom: 16 }}>
        {staff?.role === 'ADMIN' && (
          <Select
            allowClear
            placeholder="Tất cả tài xế"
            style={{ minWidth: 220 }}
            value={driver}
            onChange={setDriver}
            options={drivers.data?.map((d) => ({ value: d.id, label: d.name }))}
          />
        )}
        <Button onClick={() => setShowHistory(!showHistory)}>{showHistory ? 'Chuyến đang thực hiện' : 'Xem cả chuyến đã xong'}</Button>
        <Button loading={trips.isFetching} onClick={() => void trips.refetch()}>
          Làm mới
        </Button>
      </Space>
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
  const done = trip.orders.filter((o) => o.latestAttempt).length
  const active = trip.status === 'IN_PROGRESS'
  const waitingForDispatch = trip.orders.some((order) => order.orderStatus !== 'OUT_FOR_DELIVERY')
  const cannotDepart = !trip.orders.length || !trip.driverId || waitingForDispatch || change.isPending
  const stop = (order: DeliveryStop) => {
    const balance = receipts.data?.balances.find((b) => b.orderId === order.orderId)
    const returned = receipts.data?.receipts.filter((r) => r.orderId === order.orderId).reduce((sum, r) => sum + r.bottlesReturned, 0) ?? 0
    return (
      <li className="af-driver-stop" key={order.id}>
        <div className="af-trip-stop-top">
          <strong className="af-driver-customer">{order.recipientName || 'Khách hàng'}</strong>
          <span>{order.orderCode}</span>
          <Tag color={order.latestAttempt?.outcome === 'SUCCESS' ? 'green' : order.latestAttempt ? 'red' : 'blue'}>
            {order.latestAttempt?.outcome === 'SUCCESS'
              ? 'Đã giao'
              : order.latestAttempt
                ? 'Giao thất bại'
                : active
                  ? 'Đang giao'
                  : 'Chờ xuất phát'}
          </Tag>
        </div>
        <p className="af-driver-address">{order.deliveryAddress}</p>
        {order.requestedDeliveryAt && <p>Hẹn giao: {new Date(order.requestedDeliveryAt).toLocaleString('vi-VN')}</p>}
        {order.note && <p className="af-driver-note">{order.note}</p>}
        <ul className="af-driver-facts">
          {order.items.map((line, i) => (
            <li key={i}>
              {line.productName} × {line.quantity} {line.unit} · Lô {line.lotCode}
            </li>
          ))}
          {balance && (
            <li>
              <Wallet size={15} /> Còn thu <strong>{currency(balance.due)}</strong> · Vỏ cần đổi {balance.bottlesToExchange}, đã nhận{' '}
              {returned}
            </li>
          )}
        </ul>
        {order.latestAttempt?.failureReason && <Alert type="warning" title={order.latestAttempt.failureReason} />}
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
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.deliveryAddress)}`}
              target="_blank"
              rel="noreferrer"
            >
              Chỉ đường
            </Button>
          )}
          {active && (
            <Button size="large" disabled={!receipts.data || change.isPending} onClick={() => setCollect(order)}>
              Thu tiền / nhận vỏ
            </Button>
          )}
          {active && !order.latestAttempt && (
            <Button size="large" type="primary" disabled={change.isPending} onClick={() => setResult(order)}>
              Ghi kết quả giao
            </Button>
          )}
          {order.latestAttempt && (
            <Button size="large" onClick={() => setHistory(order)}>
              Lịch sử giao
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
          <strong>
            Chuyến #{trip.id} · {trip.driverName}
          </strong>
          <Tag>{tripLabels[trip.status]}</Tag>
        </div>
        <Progress
          percent={Math.round((done / Math.max(1, trip.orders.length)) * 100)}
          format={() => `${done}/${trip.orders.length} điểm`}
        />
        {receipts.data && (
          <div className="af-driver-totals">
            <span>
              <Wallet size={16} /> Tiền mặt cần bàn giao <strong>{currency(receipts.data.cashExpected)}</strong>
            </span>
            <span>
              <Recycle size={16} /> Vỏ đã nhận <strong>{receipts.data.bottlesExpected}</strong>
            </span>
          </div>
        )}
        {receipts.isError && <QueryError error={receipts.error} onRetry={receipts.refetch} />}
        {trip.status === 'CREATED' && waitingForDispatch && (
          <Alert
            type="info"
            showIcon
            title="Chờ cửa hàng xuất kho"
            description="Chỉ có thể bắt đầu chuyến khi tất cả đơn đã được xuất kho."
            style={{ marginBottom: 12 }}
          />
        )}
        {trip.status === 'CREATED' && (
          <Popconfirm
            title="Đã nhận đủ hàng và bắt đầu giao?"
            disabled={cannotDepart}
            onConfirm={() => change.mutateAsync(() => deliveryApi.depart(trip.id)).catch(() => {})}
          >
            <Button type="primary" disabled={cannotDepart} loading={change.isPending}>
              Bắt đầu chuyến
            </Button>
          </Popconfirm>
        )}
        {active && done === trip.orders.length && (
          <p className="af-driver-done">Đã có kết quả tất cả điểm giao. Về cửa hàng bàn giao tiền và vỏ để đối soát.</p>
        )}
      </Card>
      <ol className="af-driver-stops">{trip.orders.filter((o) => !o.latestAttempt).map(stop)}</ol>
      {done > 0 && (
        <details className="af-driver-finished">
          <summary>Đã ghi kết quả {done} điểm</summary>
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
      <Modal open={!!history} title={`Lịch sử ${history?.orderCode ?? ''}`} onCancel={() => setHistory(null)} footer={null}>
        {attempts.isError ? (
          <QueryError error={attempts.error} onRetry={attempts.refetch} />
        ) : attempts.isPending ? (
          <Skeleton active />
        ) : (
          attempts.data.map((a) => (
            <Card key={a.id} size="small" title={`Lần ${a.attemptNo} · ${a.outcome === 'SUCCESS' ? 'Thành công' : 'Thất bại'}`}>
              <p>{a.recipientName || a.failureReason}</p>
              <p>{a.note}</p>
              <p>{new Date(a.attemptedAt).toLocaleString('vi-VN')}</p>
            </Card>
          ))
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
      title={`Thu tiền / nhận vỏ · ${order.orderCode}`}
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
          <InputNumber min={0} max={balance.due} precision={2} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="method" label="Phương thức" rules={[{ required: true }]}>
          <Select
            options={[
              { value: 'CASH', label: 'Tiền mặt' },
              { value: 'BANK_TRANSFER', label: 'Đã nhận chuyển khoản' },
            ]}
          />
        </Form.Item>
        <Form.Item
          name="bottlesReturned"
          label="Số vỏ đã nhận"
          rules={[{ required: true }, { type: 'integer', min: 0, max: balance.bottlesToExchange }]}
        >
          <InputNumber min={0} max={balance.bottlesToExchange} precision={0} />
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
