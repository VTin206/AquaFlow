import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Collapse, Descriptions, Dropdown, Modal, Popconfirm, Skeleton, Tag, type MenuProps } from 'antd'
import { Ellipsis, MapPin, Phone, Truck } from 'lucide-react'
import { Money } from '@/shared/components/Money'
import { QueryError } from '@/shared/components/QueryError'
import { usePrinter } from '@/shared/print/usePrinter'
import { modalScrollBody, modalWidth } from '@/shared/utils/modal'
import { currency } from '@/shared/utils/format'
import { dueTone } from '@/shared/utils/money'
import { useStaff } from '@/features/auth/useStaff'
import { invalidateLiveData } from '@/features/live/invalidateLiveData'
import { OrderDetails } from '@/features/orders/components/OrderDetails'
import { OrderFocusBanner } from '@/features/orders/components/OrderSheet'
import { useOrderList } from '@/features/orders/orderData'
import { useSettings } from '@/features/settings/settingsService'
import { deliveryApi, type DeliveryStop, type SettlementInput } from '../deliveryApi'
import { liveTripFocus, liveTripStatus } from '../tripFocus'
import { useAvailableOrders, useDeliveryDrivers, useLiveTrip, useTripCollections } from '../useLiveTrips'
import { AttemptsTimeline } from './AttemptsTimeline'
import { DeliveryActionModal, type DeliveryAction } from './DeliveryActionModal'
import { DeliveryBottlesButton } from './DeliveryBottlesButton'
import { TripManifest } from './TripManifest'
import { TripStatusTag } from './TripStatusTag'
import { TripRouteButton } from './TripRouteButton'
import { MapLink } from '@/shared/address/MapLink'

const dateTime = (value: string) => new Date(value).toLocaleString('vi-VN')

function StopTag({ stop }: { stop: DeliveryStop }) {
  if (stop.latestAttempt?.outcome === 'SUCCESS') return <Tag color="green">Đã giao</Tag>
  if (stop.latestAttempt?.outcome === 'FAILED') return <Tag color="red">Giao thất bại</Tag>
  if (stop.orderStatus === 'PREPARING') return <Tag>Chờ xuất kho</Tag>
  return <Tag color="cyan">Đang giao</Tag>
}

/** Chi tiết chuyến: nói rõ đang cần gì, một nút chính ở chân ngăn kéo, các thao tác ít dùng gom vào menu. */
export function LiveTripDrawer({ tripId, onClose }: { tripId: number; onClose: () => void }) {
  const staff = useStaff()
  const canManage = staff?.role === 'ADMIN' || staff?.role === 'SALES_STAFF'
  const { message } = App.useApp()
  const client = useQueryClient()
  const detail = useLiveTrip(tripId)
  const collections = useTripCollections(tripId)
  const drivers = useDeliveryDrivers(canManage)
  const available = useAvailableOrders()
  const ordersQuery = useOrderList()
  const { data: settings } = useSettings()
  const printer = usePrinter()
  const [action, setAction] = useState<DeliveryAction | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [history, setHistory] = useState<DeliveryStop | null>(null)
  const attempts = useQuery({
    queryKey: ['live', 'delivery-attempts', tripId, history?.id],
    queryFn: () => deliveryApi.assignmentAttempts(history!.id),
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
  const execute = (operation: () => Promise<unknown>) => change.mutate(operation)
  const trip = detail.data

  if (!trip) {
    return (
      <Modal open centered onCancel={onClose} width={modalWidth.medium} footer={null} title={`Chuyến #${tripId}`}>
        {detail.isError ? <QueryError error={detail.error} onRetry={detail.refetch} /> : <Skeleton active />}
      </Modal>
    )
  }

  const { focus, next } = liveTripFocus(trip)
  const editable = canManage && trip.status === 'CREATED'
  const preparing = trip.orders.filter((stop) => stop.orderStatus === 'PREPARING').length
  const firstPending = trip.orders.find((stop) => !stop.latestAttempt)
  const stopOrders = trip.orders.map((stop) => ordersQuery.data?.find((order) => order.id === String(stop.orderId))).filter((order) => order !== undefined)

  const menuItems: MenuProps['items'] = [
    {
      key: 'print',
      label: 'In phiếu chuyến',
      disabled: !settings || stopOrders.length < trip.orders.length,
      onClick: () =>
        printer.print(
          <TripManifest
            trip={{
              id: `#${trip.id}`,
              driver: trip.driverName ?? 'Chưa phân tài xế',
              vehicle: trip.vehicle ?? undefined,
              orderIds: stopOrders.map((order) => order.id),
              createdAt: trip.createdAt,
              status: 'Đang giao',
            }}
            stops={stopOrders}
            settings={settings}
          />,
        ),
    },
    ...(editable && next !== 'assignDriver'
      ? [{ key: 'driver', label: trip.driverId ? 'Đổi tài xế' : 'Phân tài xế', onClick: () => setAction({ kind: 'driver', tripId: trip.id }) }]
      : []),
    ...(editable && next !== 'addOrders' ? [{ key: 'add', label: 'Thêm đơn', onClick: () => setAction({ kind: 'add', tripId: trip.id }) }] : []),
  ]

  const primary =
    !canManage && next !== 'depart' ? null : next === 'addOrders' ? (
      <Button type="primary" disabled={change.isPending} onClick={() => setAction({ kind: 'add', tripId: trip.id })}>
        Thêm đơn
      </Button>
    ) : next === 'assignDriver' ? (
      <Button type="primary" disabled={change.isPending} onClick={() => setAction({ kind: 'driver', tripId: trip.id })}>
        Phân tài xế
      </Button>
    ) : next === 'dispatch' ? (
      <Popconfirm
        title={`Xuất kho ${preparing} đơn?`}
        description="Từng đơn được xuất độc lập: đơn nào lỗi thì các đơn đã xuất trước đó vẫn giữ nguyên."
        okText="Xuất kho"
        cancelText="Chưa"
        onConfirm={() => execute(() => deliveryApi.dispatch(trip.id))}
      >
        <Button type="primary" loading={change.isPending}>
          Xuất kho {preparing} đơn
        </Button>
      </Popconfirm>
    ) : next === 'depart' ? (
      <Popconfirm
        title="Tài xế đã nhận đủ hàng và khởi hành?"
        okText="Khởi hành"
        cancelText="Chưa"
        onConfirm={() => execute(() => deliveryApi.depart(trip.id))}
      >
        <Button type="primary" loading={change.isPending}>
          Khởi hành
        </Button>
      </Popconfirm>
    ) : next === 'settle' ? (
      <Button
        type="primary"
        disabled={change.isPending || collections.isPending || collections.isError}
        onClick={() => setAction({ kind: 'settle', tripId: trip.id })}
      >
        Đối soát chuyến
      </Button>
    ) : null

  return (
    <>
      <Modal
        open
        centered
        onCancel={onClose}
        width={modalWidth.medium}
        styles={modalScrollBody}
        title={
          <div className="af-profile-head">
            <span className="af-trip-icon">
              <Truck size={20} />
            </span>
            <div className="af-cell-stack">
              <span className="af-profile-name">Chuyến #{trip.id} <TripStatusTag status={liveTripStatus(trip)} /></span>
              <small>
                {trip.driverName ?? 'Chưa phân tài xế'}
                {trip.vehicle ? ` · ${trip.vehicle}` : ''}
              </small>
            </div>
          </div>
        }

        footer={
          <div className="af-order-footer">
            <div>
              {editable && !trip.orders.some((stop) => stop.orderStatus === 'OUT_FOR_DELIVERY') && (
                <Popconfirm
                  title="Hủy chuyến này?"
                  description="Các đơn chưa xuất kho trở lại danh sách chờ xếp chuyến."
                  okText="Hủy chuyến"
                  okButtonProps={{ danger: true }}
                  cancelText="Giữ"
                  onConfirm={() => execute(() => deliveryApi.cancel(trip.id))}
                >
                  <Button type="text" danger disabled={change.isPending}>
                    Hủy chuyến
                  </Button>
                </Popconfirm>
              )}
            </div>
            <div>
              <Dropdown trigger={['click']} menu={{ items: menuItems }}>
                <Button icon={<Ellipsis size={16} />}>Thao tác khác</Button>
              </Dropdown>
              {primary}
            </div>
          </div>
        }
      >
        <OrderFocusBanner focus={focus} />
        <TripRouteButton addresses={trip.orders.map((stop) => stop.deliveryAddress)} />
        <ol className="af-trip-stops af-trip-stops-detail">
          {trip.orders.map((stop, index) => {
            const balance = collections.data?.balances.find((item) => item.orderId === stop.orderId)
            // Mỗi phân công chỉ ghi một kết quả; giao lại phải qua kiểm hàng hoàn rồi xếp chuyến mới (BE trả 409 nếu ghi lần nữa).
            const canRecord = trip.status === 'IN_PROGRESS' && stop.orderStatus === 'OUT_FOR_DELIVERY' && !stop.latestAttempt
            return (
              <li key={stop.id}>
                <span className="af-trip-stop-index">{index + 1}</span>
                <div className="af-trip-stop-body">
                  <div className="af-trip-stop-top">
                    <Button type="link" size="small" className="af-cell-truncate" onClick={() => setOrderId(String(stop.orderId))}>
                      {stop.orderCode}
                    </Button>
                    <StopTag stop={stop} />
                  </div>
                  <strong>{stop.recipientName || 'Khách hàng'}</strong>
                  {stop.latestAttempt?.failureReason && <small className="af-text-danger">Lý do: {stop.latestAttempt.failureReason}</small>}
                  {stop.deliveryAddress && (
                    <div className="af-delivery-line">
                      <MapPin size={14} />
                      <span>
                        {stop.deliveryAddress}
                        <MapLink address={stop.deliveryAddress} />
                      </span>
                    </div>
                  )}
                  {stop.recipientPhone && (
                    <div className="af-delivery-line">
                      <Phone size={14} /> <a href={`tel:${stop.recipientPhone}`}>{stop.recipientPhone}</a>
                    </div>
                  )}
                  {stop.items.length > 0 && (
                    <small className="af-text-muted">
                      {stop.items.map((line) => `${line.productName} × ${line.quantity} ${line.unit.toLowerCase()} (lô ${line.lotCode})`).join(' · ')}
                    </small>
                  )}
                  <div className="af-trip-stop-foot">
                    <small>{balance ? <Money value={balance.due} tone={dueTone(balance.due)} prefix="Thu " /> : null}</small>
                    <div className="af-trip-stop-actions">
                      {stop.latestAttempt && (
                        <Button size="small" type="text" onClick={() => setHistory(stop)}>
                          Lịch sử giao
                        </Button>
                      )}
                      {editable && stop.orderStatus !== 'OUT_FOR_DELIVERY' && (
                        <Popconfirm
                          title={`Bỏ ${stop.orderCode} khỏi chuyến?`}
                          description="Đơn quay lại danh sách chờ xếp chuyến."
                          okText="Bỏ khỏi chuyến"
                          okButtonProps={{ danger: true }}
                          cancelText="Giữ"
                          onConfirm={() => execute(() => deliveryApi.remove(trip.id, stop.orderId))}
                        >
                          <Button size="small" type="text" danger disabled={change.isPending}>
                            Bỏ khỏi chuyến
                          </Button>
                        </Popconfirm>
                      )}
                      {editable && trip.driverId && stop.orderStatus === 'PREPARING' && (
                        <Popconfirm
                          title={`Xuất kho đơn ${stop.orderCode}?`}
                          okText="Xuất kho"
                          cancelText="Chưa"
                          onConfirm={() => execute(() => deliveryApi.dispatchAssignment(stop.id))}
                        >
                          <Button size="small" disabled={change.isPending}>
                            Xuất kho
                          </Button>
                        </Popconfirm>
                      )}
                      {canRecord && (
                        <Button
                          size="small"
                          type={stop === firstPending ? 'primary' : 'default'}
                          disabled={change.isPending}
                          onClick={() => setAction({ kind: 'result', tripId: trip.id, order: stop })}
                        >
                          Ghi kết quả
                        </Button>
                      )}
                      <DeliveryBottlesButton assignmentId={stop.id} orderCode={stop.orderCode} />
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>

        {trip.settlement && <SettlementResult settlement={trip.settlement} />}
        {collections.isError && <QueryError error={collections.error} onRetry={collections.refetch} />}
        {collections.data && trip.status !== 'CREATED' && (
          <Collapse
            ghost
            className="af-order-more"
            items={[
              {
                key: 'collections',
                label: 'Tiền và vỏ đã thu',
                extra: `${currency(collections.data.cashExpected)} · ${collections.data.bottlesExpected} vỏ`,
                children: collections.data.receipts.length ? (
                  <ul className="af-return-list">
                    {collections.data.receipts.map((receipt) => (
                      <li key={receipt.id}>
                        <strong>{trip.orders.find((stop) => stop.orderId === receipt.orderId)?.orderCode ?? `Đơn #${receipt.orderId}`}</strong>
                        <span>
                          {currency(receipt.amount)} · {receipt.method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'} · {receipt.bottlesReturned} vỏ
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="af-order-more-empty">Tài xế chưa ghi khoản thu nào.</p>
                ),
              },
            ]}
          />
        )}
      </Modal>

      {action && (
        <DeliveryActionModal
          key={`${action.kind}-${action.kind === 'result' ? action.order.id : ''}`}
          action={action}
          expected={
            action.kind === 'settle' && collections.data?.receipts.length
              ? { cash: collections.data.cashExpected, bottles: collections.data.bottlesExpected }
              : undefined
          }
          loading={change.isPending}
          drivers={drivers.data ?? []}
          available={available.data ?? []}
          optionError={action.kind === 'driver' ? drivers.error : action.kind === 'add' ? available.error : null}
          onRetry={() => {
            void drivers.refetch()
            void available.refetch()
          }}
          onClose={() => setAction(null)}
          onSubmit={async (values) => {
            try {
              await change.mutateAsync(async () => {
                if (action.kind === 'driver') return deliveryApi.assign(trip.id, values.driverId!)
                if (action.kind === 'add') {
                  const selected = available.data?.find((order) => order.id === values.orderId)
                  return deliveryApi.add(trip.id, values.orderId!, selected?.redeliveryEligible ?? false)
                }
                if (action.kind === 'result') {
                  return deliveryApi.assignmentResult(action.order.id, {
                    outcome: values.outcome!,
                    recipientName: values.outcome === 'SUCCESS' ? values.recipientName : undefined,
                    failureReason: values.outcome === 'FAILED' ? values.failureReason : undefined,
                    note: values.note,
                  })
                }
                return deliveryApi.settle(trip.id, values as SettlementInput)
              })
              setAction(null)
            } catch {
              /* Thông báo lỗi đã hiện; giữ nguyên dữ liệu đã nhập để sửa và lưu lại. */
            }
          }}
        />
      )}
      <Modal open={history !== null} title={`Lịch sử giao ${history?.orderCode ?? ''}`} onCancel={() => setHistory(null)} footer={null}>
        {attempts.isError ? (
          <QueryError error={attempts.error} onRetry={attempts.refetch} />
        ) : attempts.isPending ? (
          <Skeleton active />
        ) : (
          <AttemptsTimeline attempts={attempts.data} />
        )}
      </Modal>
      {orderId && <OrderDetails id={orderId} onClose={() => setOrderId(null)} />}
      {printer.portal}
    </>
  )
}

function SettlementResult({ settlement }: { settlement: SettlementInput & { handedOverAt: string } }) {
  return (
    <Descriptions
      className="af-trip-settle"
      size="small"
      column={1}
      title="Kết quả đối soát"
      items={[
        {
          key: 'cash',
          label: 'Tiền mặt',
          children: (
            <>
              <Money value={settlement.cashConfirmed} tone={settlement.cashConfirmed < settlement.cashReported ? 'refund' : 'paid'} /> / tài xế báo{' '}
              {currency(settlement.cashReported)} {settlement.cashConfirmed !== settlement.cashReported && <Tag color="red">Lệch</Tag>}
            </>
          ),
        },
        {
          key: 'bottles',
          label: 'Vỏ rỗng',
          children: (
            <>
              {settlement.bottlesConfirmed} / dự kiến {settlement.bottlesExpected}{' '}
              {settlement.bottlesConfirmed !== settlement.bottlesExpected && <Tag color="red">Lệch</Tag>}
            </>
          ),
        },
        ...(settlement.note ? [{ key: 'note', label: 'Ghi chú', children: settlement.note }] : []),
        { key: 'at', label: 'Thời điểm', children: dateTime(settlement.handedOverAt) },
      ]}
    />
  )
}
