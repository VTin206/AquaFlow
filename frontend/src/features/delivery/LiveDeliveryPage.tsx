import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  App,
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Tag,
} from 'antd'
import { Page } from '@/shared/components/Page'
import { QueryError } from '@/shared/components/QueryError'
import { useAuth } from '@/features/auth/useAuth'
import { useStaff } from '@/features/auth/useStaff'
import { invalidateLiveData } from '@/features/live/invalidateLiveData'
import { currency } from '@/shared/utils/format'
import { collectionApi, deliveryApi, tripLabels, type DeliveryStop, type ResultInput, type SettlementInput } from './deliveryApi'

type Action = { kind: 'create' | 'driver' | 'add' | 'settle'; tripId?: number } | { kind: 'result'; tripId: number; order: DeliveryStop }
const dateTime = (value: string | null) => (value ? new Date(value).toLocaleString('vi-VN') : '—')

export function LiveDeliveryPage({ driverView = false }: { driverView?: boolean }) {
  const [searchParams] = useSearchParams()
  const staff = useStaff()
  const { user } = useAuth()
  const admin = staff?.role === 'ADMIN' || staff?.role === 'SALES_STAFF'
  const canOperate = admin || staff?.role === 'DELIVERY_STAFF'
  const who = [user?.email, staff?.role]
  const client = useQueryClient()
  const { message } = App.useApp()
  const [selected, setSelected] = useState<number | null>(() => {
    const value = Number(searchParams.get('tripId'))
    return Number.isSafeInteger(value) && value > 0 ? value : null
  })
  const [action, setAction] = useState<Action | null>(null)
  const [history, setHistory] = useState<{ tripId: number; order: DeliveryStop } | null>(null)
  const trips = useQuery({ queryKey: ['live', 'delivery-trips', ...who], queryFn: deliveryApi.list, refetchInterval: 15000 })
  const detail = useQuery({
    queryKey: ['live', 'delivery-trip', ...who, selected],
    queryFn: () => deliveryApi.detail(selected!),
    enabled: selected !== null,
    refetchInterval: 15000,
  })
  const drivers = useQuery({ queryKey: ['live', 'delivery-drivers', ...who], queryFn: deliveryApi.drivers, enabled: admin })
  const available = useQuery({ queryKey: ['live', 'delivery-available', ...who], queryFn: deliveryApi.available, enabled: admin })
  const attempts = useQuery({
    queryKey: ['live', 'delivery-attempts', ...who, history?.tripId, history?.order.orderId],
    queryFn: () => deliveryApi.attempts(history!.tripId, history!.order.orderId),
    enabled: history !== null,
  })
  const change = useMutation({
    mutationFn: (operation: () => Promise<unknown>) => operation(),
    onSuccess: async () => {
      await invalidateLiveData(client)
      message.success('Đã cập nhật chuyến giao.')
    },
    onError: async (error: Error) => {
      await invalidateLiveData(client)
      message.error(error.message)
    },
  })
  const trip = detail.data
  const collections = useQuery({
    queryKey: ['live', 'delivery-collections', ...who, selected],
    queryFn: () => collectionApi.get(selected!),
    enabled: selected !== null,
    refetchInterval: 15000,
  })
  const execute = (operation: () => Promise<unknown>) => change.mutate(operation)

  return (
    <Page
      title={driverView ? 'Chuyến của tôi' : 'Giao hàng'}
      description={
        driverView
          ? 'Xem hàng trên chuyến, liên hệ khách và ghi nhận từng lần giao.'
          : 'Xếp đơn đang chuẩn bị vào chuyến, xuất kho theo chuyến, phân tài xế và theo dõi kết quả giao.'
      }
      actions={
        <Space>
          <Button onClick={() => void invalidateLiveData(client)}>Làm mới</Button>
          {admin && !driverView && (
            <Button type="primary" onClick={() => setAction({ kind: 'create' })}>
              Tạo chuyến
            </Button>
          )}
        </Space>
      }
    >
      {admin && !driverView && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title={`${available.data?.length ?? 0} đơn chờ xếp chuyến hoặc đủ điều kiện giao lại`}
          description="Thêm đơn DELIVERY đang chuẩn bị vào chuyến. Đơn giao thất bại chỉ hiện lại sau khi kho đã kiểm nhận hàng trả; khi thêm vào chuyến, hệ thống sẽ giữ reservation mới."
        />
      )}
      {trips.isError ? (
        <QueryError error={trips.error} onRetry={trips.refetch} />
      ) : trips.isPending ? (
        <Spin />
      ) : !trips.data.length ? (
        <Empty description="Chưa có chuyến giao." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 16 }}>
          {trips.data.map((item) => (
            <Card key={item.id} title={`Chuyến #${item.id}`} extra={<Tag>{tripLabels[item.status]}</Tag>}>
              <p>
                {item.driverName ?? 'Chưa phân tài xế'} · {item.vehicle || 'Chưa ghi xe'}
              </p>
              <p>
                {item.orders.length} đơn · {item.orders.filter((o) => o.latestAttempt?.outcome === 'SUCCESS').length} giao thành công
              </p>
              <p>{dateTime(item.createdAt)}</p>
              <Button type="primary" onClick={() => setSelected(item.id)}>
                Mở chuyến
              </Button>
            </Card>
          ))}
        </div>
      )}
      <Drawer open={selected !== null} onClose={() => setSelected(null)} title={`Chuyến #${selected}`} size="large">
        {detail.isError ? (
          <QueryError error={detail.error} onRetry={detail.refetch} />
        ) : detail.isPending ? (
          <Spin />
        ) : (
          trip && (
            <>
              <Descriptions
                column={1}
                items={[
                  { key: 'status', label: 'Trạng thái', children: tripLabels[trip.status] },
                  { key: 'driver', label: 'Tài xế', children: trip.driverName ?? 'Chưa phân công' },
                  { key: 'vehicle', label: 'Xe', children: trip.vehicle || '—' },
                  { key: 'start', label: 'Khởi hành', children: dateTime(trip.startedAt) },
                ]}
              />
              <Space wrap style={{ marginBottom: 16 }}>
                {admin && trip.status === 'CREATED' && (
                  <>
                    <Button disabled={change.isPending} onClick={() => setAction({ kind: 'driver', tripId: trip.id })}>
                      Phân tài xế
                    </Button>
                    <Button disabled={change.isPending} onClick={() => setAction({ kind: 'add', tripId: trip.id })}>
                      Thêm đơn
                    </Button>
                    {!trip.orders.some((o) => o.orderStatus === 'OUT_FOR_DELIVERY') && (
                      <Popconfirm
                        title="Hủy chuyến chưa xuất kho?"
                        description="Đơn chưa xuất kho và reservation giao lại sẽ được trả về hàng chờ phù hợp."
                        onConfirm={() => execute(() => deliveryApi.cancel(trip.id))}
                      >
                        <Button danger disabled={change.isPending}>
                          Hủy chuyến
                        </Button>
                      </Popconfirm>
                    )}
                  </>
                )}
                {admin && trip.status === 'CREATED' && trip.orders.some((o) => o.orderStatus === 'PREPARING') && (
                  <Popconfirm
                    title={`Xuất kho toàn bộ ${trip.orders.filter((o) => o.orderStatus === 'PREPARING').length} đơn đang chuẩn bị?`}
                    description="Thao tác xuất kho được thực hiện nguyên chuyến trong một transaction. Nếu một đơn lỗi, toàn bộ sẽ được hoàn tác."
                    onConfirm={() => execute(() => deliveryApi.dispatch(trip.id))}
                  >
                    <Button danger loading={change.isPending} disabled={change.isPending}>Xuất kho chuyến</Button>
                  </Popconfirm>
                )}
                {canOperate && trip.status === 'CREATED' && (
                  <Popconfirm
                    title="Xác nhận tài xế đã nhận hàng và khởi hành?"
                    onConfirm={() => execute(() => deliveryApi.depart(trip.id))}
                  >
                    <Button type="primary" loading={change.isPending} disabled={!trip.driverId || !trip.orders.length || trip.orders.some((o) => o.orderStatus !== 'OUT_FOR_DELIVERY') || change.isPending}>
                      Khởi hành
                    </Button>
                  </Popconfirm>
                )}
                {admin && trip.status === 'IN_PROGRESS' && (
                  <Button
                    disabled={change.isPending || collections.isPending || collections.isError || trip.orders.some((o) => !o.latestAttempt)}
                    onClick={() => setAction({ kind: 'settle', tripId: trip.id })}
                  >
                    Đối soát chuyến
                  </Button>
                )}
              </Space>
              {!trip.orders.length && <Empty description="Chuyến chưa có đơn. Thêm đơn DELIVERY đang chuẩn bị để bắt đầu." />}
              {trip.orders.map((order) => (
                <Card
                  key={order.id}
                  size="small"
                  title={order.orderCode}
                  style={{ marginBottom: 12 }}
                  extra={
                    order.latestAttempt && (
                      <Tag color={order.latestAttempt.outcome === 'SUCCESS' ? 'green' : 'red'}>
                        {order.latestAttempt.outcome === 'SUCCESS' ? 'Đã giao' : 'Giao thất bại'}
                      </Tag>
                    )
                  }
                >
                  <p>
                    <strong>{order.recipientName || 'Khách hàng'}</strong>
                    {order.recipientPhone && (
                      <>
                        {' '}
                        · <a href={`tel:${order.recipientPhone}`}>{order.recipientPhone}</a>
                      </>
                    )}
                  </p>
                  <p>{order.deliveryAddress}</p>
                  {order.deliveryAddress && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.deliveryAddress)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Chỉ đường
                    </a>
                  )}
                  <ul>
                    {order.items.map((line, index) => (
                      <li key={`${line.productId}-${index}`}>
                        {line.productName} × {line.quantity} {line.unit} · Lô {line.lotCode}
                      </li>
                    ))}
                  </ul>
                  {order.latestAttempt?.failureReason && (
                    <Alert type="warning" title={order.latestAttempt.failureReason} style={{ marginBottom: 12 }} />
                  )}
                  <Space wrap>
                    {canOperate && trip.status === 'IN_PROGRESS' && order.latestAttempt?.outcome !== 'SUCCESS' && (
                      <Button
                        type="primary"
                        disabled={change.isPending}
                        onClick={() => setAction({ kind: 'result', tripId: trip.id, order })}
                      >
                        Ghi kết quả giao
                      </Button>
                    )}
                    {admin && trip.status === 'CREATED' && order.orderStatus !== 'OUT_FOR_DELIVERY' && (
                      <Popconfirm title="Bỏ đơn khỏi chuyến?" onConfirm={() => execute(() => deliveryApi.remove(trip.id, order.orderId))}>
                        <Button danger disabled={change.isPending}>
                          Bỏ khỏi chuyến
                        </Button>
                      </Popconfirm>
                    )}
                    {order.latestAttempt && <Button onClick={() => setHistory({ tripId: trip.id, order })}>Lịch sử giao</Button>}
                  </Space>
                </Card>
              ))}
              {trip.settlement && (
                <Card title="Biên bản đối soát" size="small">
                  <p>
                    Tiền tài xế báo: {currency(trip.settlement.cashReported)} · Thực nhận: {currency(trip.settlement.cashConfirmed)}
                  </p>
                  <p>
                    Vỏ dự kiến: {trip.settlement.bottlesExpected} · Thực nhận: {trip.settlement.bottlesConfirmed}
                  </p>
                  <p>{trip.settlement.note}</p>
                  <p>{dateTime(trip.settlement.handedOverAt)}</p>
                </Card>
              )}
              {collections.isError && <QueryError error={collections.error} onRetry={collections.refetch} />}
              {collections.data && (
                <Card size="small" title="Tiền và vỏ đã thu">
                  <p>
                    Tiền mặt bàn giao: {currency(collections.data.cashExpected)} · Vỏ đã nhận: {collections.data.bottlesExpected}
                  </p>
                  {collections.data.receipts.map((r) => (
                    <p key={r.id}>
                      Đơn #{r.orderId} · {currency(r.amount)} ({r.method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}) · {r.bottlesReturned} vỏ
                    </p>
                  ))}
                </Card>
              )}
            </>
          )
        )}
      </Drawer>
      {action && (
        <DeliveryActionModal
          key={`${action.kind}-${action.tripId ?? 0}-${action.kind === 'result' ? action.order.orderId : ''}`}
          action={action}
          expected={
            action.kind === 'settle' && collections.data?.receipts.length
              ? { cash: collections.data.cashExpected, bottles: collections.data.bottlesExpected }
              : undefined
          }
          loading={change.isPending}
          drivers={drivers.data ?? []}
          available={available.data ?? []}
          optionError={
            action.kind === 'create' || action.kind === 'driver' ? drivers.error : action.kind === 'add' ? available.error : null
          }
          onRetry={() => {
            void drivers.refetch()
            void available.refetch()
          }}
          onClose={() => setAction(null)}
          onSubmit={async (values) => {
            try {
              await change.mutateAsync(async () => {
                if (action.kind === 'create') {
                  const created = await deliveryApi.create({ driverId: values.driverId, vehicle: values.vehicle })
                  setSelected(created.id)
                  return created
                }
                if (action.kind === 'driver') return deliveryApi.assign(action.tripId!, values.driverId!)
                if (action.kind === 'add') {
                  const selectedOrder = available.data?.find((order) => order.id === values.orderId)
                  return deliveryApi.add(action.tripId!, values.orderId!, selectedOrder?.redeliveryEligible ?? false)
                }
                if (action.kind === 'result')
                  return deliveryApi.result(action.tripId, action.order.orderId, {
                    outcome: values.outcome!,
                    recipientName: values.outcome === 'SUCCESS' ? values.recipientName : undefined,
                    failureReason: values.outcome === 'FAILED' ? values.failureReason : undefined,
                    note: values.note,
                  })
                return deliveryApi.settle(action.tripId!, values as SettlementInput)
              })
              setAction(null)
            } catch {
              /* Mutation displays the API error and keeps the entered values. */
            }
          }}
        />
      )}
      <Modal
        open={history !== null}
        title={`Lịch sử giao ${history?.order.orderCode ?? ''}`}
        onCancel={() => setHistory(null)}
        footer={<Button onClick={() => setHistory(null)}>Đóng</Button>}
      >
        {attempts.isError ? (
          <QueryError error={attempts.error} onRetry={attempts.refetch} />
        ) : attempts.isPending ? (
          <Spin />
        ) : (
          attempts.data.map((attempt) => (
            <Card
              key={attempt.id}
              size="small"
              title={`Lần ${attempt.attemptNo} · ${attempt.outcome === 'SUCCESS' ? 'Thành công' : 'Thất bại'}`}
              style={{ marginBottom: 12 }}
            >
              <p>{dateTime(attempt.attemptedAt)}</p>
              <p>{attempt.recipientName || attempt.failureReason}</p>
              <p>{attempt.note}</p>
            </Card>
          ))
        )}
      </Modal>
    </Page>
  )
}

type FormValues = Partial<SettlementInput & ResultInput> & { driverId?: number; orderId?: number; vehicle?: string }
export function DeliveryActionModal({
  action,
  expected,
  drivers,
  available,
  optionError,
  onRetry,
  loading,
  onClose,
  onSubmit,
}: {
  action: Action
  expected?: { cash: number; bottles: number }
  drivers: { id: number; name: string }[]
  available: { id: number; orderCode: string; recipientName: string | null; deliveryFailed: boolean; redeliveryEligible: boolean }[]
  optionError: Error | null
  onRetry: () => void
  loading: boolean
  onClose: () => void
  onSubmit: (values: FormValues) => Promise<void>
}) {
  const [form] = Form.useForm<FormValues>()
  const outcome = Form.useWatch('outcome', form) ?? 'SUCCESS'
  const title = {
    create: 'Tạo chuyến giao',
    driver: 'Phân tài xế',
    add: 'Thêm đơn đang chuẩn bị hoặc giao lại',
    result: 'Kết quả giao hàng',
    settle: 'Đối soát chuyến',
  }[action.kind]
  return (
    <Modal
      open
      title={title}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={loading}
      okButtonProps={{ disabled: !!optionError || loading }}
      okText="Lưu"
      cancelText="Đóng"
    >
      {optionError && <QueryError error={optionError} onRetry={onRetry} />}
      <Form
        form={form}
        layout="vertical"
        onFinish={onSubmit}
        initialValues={{
          outcome: 'SUCCESS',
          recipientName: action.kind === 'result' ? action.order.recipientName : undefined,
          cashReported: expected?.cash ?? 0,
          cashConfirmed: expected?.cash ?? 0,
          bottlesExpected: expected?.bottles ?? 0,
          bottlesConfirmed: expected?.bottles ?? 0,
        }}
      >
        {(action.kind === 'create' || action.kind === 'driver') && (
          <>
            <Form.Item name="driverId" label="Tài xế" rules={[{ required: action.kind === 'driver', message: 'Chọn tài xế.' }]}>
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Chọn tài xế đang hoạt động"
                options={drivers.map((d) => ({ value: d.id, label: d.name }))}
              />
            </Form.Item>
            {!drivers.length && !optionError && (
              <Alert type="info" title="Chưa có tài xế đang hoạt động. Có thể tạo chuyến trước và phân tài xế sau." />
            )}
            {action.kind === 'create' && (
              <Form.Item name="vehicle" label="Xe / biển số">
                <Input maxLength={40} />
              </Form.Item>
            )}
          </>
        )}
        {action.kind === 'add' && (
          <Form.Item name="orderId" label="Đơn chờ xếp chuyến" rules={[{ required: true, message: 'Chọn đơn hàng.' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={available.map((o) => ({
                value: o.id,
                label: `${o.orderCode} · ${o.recipientName || 'Khách hàng'}${o.redeliveryEligible ? ' · Đã kiểm nhận, giao lại' : ''}`,
              }))}
              notFoundContent="Không có đơn đang chuẩn bị hoặc đủ điều kiện giao lại"
            />
          </Form.Item>
        )}
        {action.kind === 'result' && (
          <>
            <Form.Item name="outcome" label="Kết quả" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'SUCCESS', label: 'Giao thành công' },
                  { value: 'FAILED', label: 'Giao thất bại' },
                ]}
              />
            </Form.Item>
            {outcome === 'SUCCESS' ? (
              <Form.Item
                name="recipientName"
                label="Người nhận thực tế"
                rules={[{ required: true, whitespace: true, message: 'Nhập tên người nhận.' }]}
              >
                <Input maxLength={150} />
              </Form.Item>
            ) : (
              <Form.Item
                name="failureReason"
                label="Lý do thất bại"
                rules={[{ required: true, whitespace: true, message: 'Nhập lý do giao thất bại.' }]}
              >
                <Input.TextArea maxLength={2000} />
              </Form.Item>
            )}
          </>
        )}
        {action.kind === 'settle' && (
          <>
            <Alert
              type="info"
              title="Ghi nhận tiền và vỏ tài xế bàn giao. Số liệu này không tự thanh toán đơn hoặc nhập lại hàng vào kho."
              style={{ marginBottom: 12 }}
            />
            {(
              [
                ['cashReported', 'Tiền tài xế báo'],
                ['cashConfirmed', 'Tiền thực nhận'],
                ['bottlesExpected', 'Vỏ dự kiến'],
                ['bottlesConfirmed', 'Vỏ thực nhận'],
              ] as const
            ).map(([name, label]) => (
              <Form.Item key={name} name={name} label={label} rules={[{ required: true, message: 'Nhập số lượng / số tiền.' }]}>
                <InputNumber
                  disabled={!!expected && (name === 'cashReported' || name === 'bottlesExpected')}
                  min={0}
                  max={name.startsWith('cash') ? 999999999999.99 : 2147483647}
                  precision={name.startsWith('cash') ? 2 : 0}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            ))}
          </>
        )}
        {(action.kind === 'result' || action.kind === 'settle') && (
          <Form.Item name="note" label={action.kind === 'settle' ? 'Ghi chú / lý do chênh lệch' : 'Ghi chú'}>
            <Input.TextArea maxLength={action.kind === 'result' ? 1000 : 2000} />
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}
