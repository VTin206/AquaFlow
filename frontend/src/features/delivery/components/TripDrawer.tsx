import { useState } from 'react'
import { App, Button, Descriptions, Drawer, Form, Input, InputNumber, Popconfirm, Select, Space, Tag, Typography } from 'antd'
import { MapPin, Phone, Printer, Truck } from 'lucide-react'
import { usePrinter } from '@/shared/print/usePrinter'
import { Money } from '@/shared/components/Money'
import { dueTone } from '@/shared/utils/money'
import { currency } from '@/shared/utils/format'
import { useSettings } from '@/features/settings/settingsService'
import { AdvanceStatusButton } from '@/features/orders/components/AdvanceStatusButton'
import { OrderDetailsModal } from '@/features/orders/components/OrderDetailsModal'
import { LateTag } from '@/features/orders/components/LateTag'
import { OrderStatusTag } from '@/features/orders/components/OrderStatusTag'
import { canDispatch } from '@/features/orders/orderService'
import { amountDue, awaitingReturnInspection, deliveryAttempts, jugCount } from '@/features/orders/types'
import { useOrders } from '@/features/orders/useOrders'
import type { SettlementDraft } from '../types'
import { dispatchedIn, openIn } from '../tripService'
import { useTripAction, useTrips } from '../useTrips'
import { TripManifest } from './TripManifest'
import { TripStatusTag } from './TripStatusTag'

/** Chi tiết chuyến: danh sách điểm giao, ghi kết quả từng đơn và đối soát tiền/vỏ khi về. */
export function TripDrawer({ tripId, onClose }: { tripId: string; onClose: () => void }) {
  const { message, modal } = App.useApp()
  const { data: settings } = useSettings()
  const printer = usePrinter()
  const { data: trips = [] } = useTrips()
  const { data: orders = [] } = useOrders()
  const action = useTripAction()
  const [form] = Form.useForm<SettlementDraft>()
  const [orderId, setOrderId] = useState<string | null>(null)
  const [adding, setAdding] = useState<string[]>([])
  const cash = Form.useWatch('cashHandedOver', form)
  const bottles = Form.useWatch('bottlesHandedOver', form)
  const trip = trips.find((item) => item.id === tripId)
  if (!trip) return null

  const stops = trip.orderIds.map((id) => orders.find((order) => order.id === id)).filter((order) => order !== undefined)
  const done = stops.filter((order) => !openIn(trip, order)).length
  const undispatched = stops.filter((order) => !dispatchedIn(trip, order))
  // Đơn chờ giao chưa thuộc chuyến nào đang chạy: thêm được vào chuyến chưa đối soát.
  const busy = new Set(trips.filter((item) => !item.settlement).flatMap((item) => item.orderIds.filter((id) => {
    const order = orders.find((entry) => entry.id === id)
    return !order || openIn(item, order)
  })))
  const addable = orders.filter((order) => canDispatch(order) && !busy.has(order.id))
  const expected = trip.expected ?? { cash: 0, bottles: 0 }
  const mismatch = cash !== undefined && bottles !== undefined && (cash !== expected.cash || bottles !== expected.bottles)
  const run = (payload: Parameters<typeof action.mutate>[0], success: string, close = false) =>
    action.mutate(payload, {
      onSuccess: () => {
        message.success(success)
        if (close) onClose()
      },
      onError: (error) => message.error(error.message),
    })

  return (
    <>
      <Drawer
        open
        onClose={onClose}
        size={600}
        title={
          <div className="af-profile-head">
            <span className="af-trip-icon">
              <Truck size={20} />
            </span>
            <div className="af-cell-stack">
              <span className="af-profile-name">Chuyến {trip.id}</span>
              <small>
                {trip.driver}
                {trip.vehicle ? ` · ${trip.vehicle}` : ''}
              </small>
            </div>
          </div>
        }
        extra={
          <Space>
            <TripStatusTag status={trip.status} />
            <Button size="small" icon={<Printer size={14} />} aria-label="In phiếu chuyến" onClick={() => printer.print(<TripManifest trip={trip} stops={stops} settings={settings} />)}>
              In phiếu
            </Button>
          </Space>
        }
      >
        {!trip.settlement && (undispatched.length > 0 || !trip.departedAt) && (
          <Space className="af-detail-actions" wrap>
            {undispatched.length > 0 && (
              <Popconfirm
                title={`Xuất kho ${undispatched.length} đơn?`}
                description="Xuất toàn bộ hàng đã giữ của từng đơn theo lô (FEFO). Đơn đã xuất không bỏ khỏi chuyến được."
                okText="Xuất kho"
                cancelText="Chưa"
                onConfirm={() => run({ kind: 'dispatch', id: trip.id }, `Đã xuất kho ${undispatched.length} đơn của chuyến ${trip.id}.`)}
              >
                <Button type="primary" loading={action.isPending}>
                  Xuất kho tất cả ({undispatched.length})
                </Button>
              </Popconfirm>
            )}
            {!trip.departedAt && (
              <Popconfirm title="Hủy chuyến này?" description="Các đơn trở lại danh sách chờ xếp chuyến." okText="Hủy chuyến" cancelText="Giữ" onConfirm={() => run({ kind: 'cancel', id: trip.id }, 'Đã hủy chuyến.', true)}>
                <Button danger>Hủy chuyến</Button>
              </Popconfirm>
            )}
          </Space>
        )}
        {!trip.departedAt && addable.length > 0 && (
          <div className="af-trip-add">
            <Select
              mode="multiple"
              allowClear
              aria-label="Thêm đơn vào chuyến"
              placeholder={`Thêm đơn chờ giao (${addable.length})`}
              value={adding}
              onChange={setAdding}
              options={addable.map((order) => ({ value: order.id, label: `${order.id} · ${order.customer}` }))}
              className="af-trip-add-select"
            />
            <Button
              disabled={!adding.length}
              loading={action.isPending}
              onClick={() => action.mutate({ kind: 'addOrders', id: trip.id, orderIds: adding }, {
                onSuccess: () => {
                  message.success(`Đã thêm ${adding.length} đơn vào chuyến.`)
                  setAdding([])
                },
                onError: (error) => message.error(error.message),
              })}
            >
              Thêm vào chuyến
            </Button>
          </div>
        )}
        {trip.departedAt && !trip.settlement && (
          <p className="af-trip-progress">
            Đã có kết quả <strong>{done}/{stops.length}</strong> điểm giao. Ghi kết quả từng đơn, sau đó đối soát khi tài xế về.
          </p>
        )}

        <ol className="af-trip-stops af-trip-stops-detail">
          {stops.map((order, index) => (
            <li key={order.id}>
              <span className="af-trip-stop-index">{index + 1}</span>
              <div className="af-trip-stop-body">
                <div className="af-trip-stop-top">
                  <Button type="link" size="small" onClick={() => setOrderId(order.id)}>
                    {order.id}
                  </Button>
                  {dispatchedIn(trip, order) ? <OrderStatusTag status={order.status} method={order.method} /> : <Tag>Chờ xuất kho</Tag>}
                  {awaitingReturnInspection(order) && <Tag color="orange">Chờ kiểm hàng hoàn</Tag>}
                  <LateTag order={order} />
                </div>
                <strong>{order.customer}</strong>
                {deliveryAttempts(order).length > 0 && (
                  <small className="af-text-muted">
                    {deliveryAttempts(order).map((attempt, index) => `Lần ${index + 1}: ${attempt.success ? 'thành công' : `thất bại (${attempt.reason})`}`).join(' · ')}
                  </small>
                )}
                <div className="af-delivery-line">
                  <MapPin size={14} /> {order.address}
                </div>
                {order.phone && (
                  <div className="af-delivery-line">
                    <Phone size={14} /> <a href={`tel:${order.phone.replace(/\s/g, '')}`}>{order.phone}</a>
                  </div>
                )}
                <div className="af-trip-stop-foot">
                  <small>
                    {jugCount(order) ? `${jugCount(order)} bình · ` : ''}thu <Money value={amountDue(order)} tone={dueTone(amountDue(order))} />
                    {order.bottles ? ` · vỏ về ${order.bottles.returned}` : ''}
                  </small>
                  {!dispatchedIn(trip, order) && !trip.settlement ? (
                    <Space size={4}>
                      <Popconfirm
                        title={`Bỏ ${order.id} khỏi chuyến?`}
                        description="Đơn quay lại danh sách chờ xếp chuyến."
                        okText="Bỏ khỏi chuyến"
                        okButtonProps={{ danger: true }}
                        cancelText="Giữ"
                        onConfirm={() => run({ kind: 'removeOrder', id: trip.id, orderId: order.id }, `Đã bỏ ${order.id} khỏi chuyến.`, stops.length === 1)}
                      >
                        <Button size="small" type="text" danger>
                          Bỏ khỏi chuyến
                        </Button>
                      </Popconfirm>
                      {canDispatch(order) && (
                        <Popconfirm title={`Xuất kho đơn ${order.id}?`} okText="Xuất kho" cancelText="Chưa" onConfirm={() => run({ kind: 'dispatch', id: trip.id, orderId: order.id }, `Đã xuất kho đơn ${order.id}.`)}>
                          <Button size="small">Xuất kho</Button>
                        </Popconfirm>
                      )}
                    </Space>
                  ) : (
                    openIn(trip, order) && <AdvanceStatusButton order={order} />
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>

        {trip.status === 'Chờ đối soát' && (
          <div className="af-trip-settle">
            <Typography.Title level={5}>Đối soát cuối chuyến</Typography.Title>
            <Form
              form={form}
              layout="vertical"
              initialValues={{ cashHandedOver: expected.cash, bottlesHandedOver: expected.bottles }}
              onFinish={(draft) =>
                modal.confirm({
                  title: `Chốt đối soát chuyến ${trip.id}?`,
                  content: `Tiền mặt ${currency(draft.cashHandedOver)} · ${draft.bottlesHandedOver} vỏ. Sau khi chốt không sửa được.`,
                  okText: 'Chốt đối soát',
                  cancelText: 'Xem lại',
                  centered: true,
                  onOk: () => run({ kind: 'settle', id: trip.id, draft }, `Đã đối soát chuyến ${trip.id}.`),
                })
              }
            >
              <Space wrap size={16}>
                <Form.Item name="cashHandedOver" label={`Tiền mặt nhận (sổ: ${currency(expected.cash)})`} rules={[{ required: true, message: 'Nhập số tiền.' }]}>
                  <InputNumber<number> min={0} step={1000} precision={0} style={{ width: 200 }} formatter={(value) => `${value ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} parser={(value) => Number(value?.replace(/\./g, '') ?? 0)} />
                </Form.Item>
                <Form.Item name="bottlesHandedOver" label={`Vỏ rỗng nhận (sổ: ${expected.bottles})`} rules={[{ required: true, message: 'Nhập số vỏ.' }]}>
                  <InputNumber min={0} precision={0} style={{ width: 160 }} />
                </Form.Item>
              </Space>
              <Form.Item name="note" label="Ghi chú chênh lệch" rules={[{ required: mismatch, whitespace: true, message: 'Có chênh lệch, ghi rõ lý do.' }, { max: 300 }]}>
                <Input.TextArea rows={2} placeholder={mismatch ? 'Thiếu tiền, vỏ để lại nhà khách...' : 'Không có chênh lệch'} />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={action.isPending}>
                Xác nhận đối soát
              </Button>
            </Form>
          </div>
        )}

        {trip.settlement && (
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
                    <Money value={trip.settlement.cashHandedOver} tone={trip.settlement.cashHandedOver < trip.settlement.cashExpected ? 'refund' : 'paid'} /> / sổ {currency(trip.settlement.cashExpected)}{' '}
                    {trip.settlement.cashHandedOver !== trip.settlement.cashExpected && <Tag color="red">Lệch</Tag>}
                  </>
                ),
              },
              {
                key: 'bottles',
                label: 'Vỏ rỗng',
                children: (
                  <>
                    {trip.settlement.bottlesHandedOver} / sổ {trip.settlement.bottlesExpected}{' '}
                    {trip.settlement.bottlesHandedOver !== trip.settlement.bottlesExpected && <Tag color="red">Lệch</Tag>}
                  </>
                ),
              },
              { key: 'note', label: 'Ghi chú', children: trip.settlement.note ?? '—' },
              { key: 'at', label: 'Thời điểm', children: new Date(trip.settlement.settledAt).toLocaleString('vi-VN') },
            ]}
          />
        )}
      </Drawer>
      {orderId && <OrderDetailsModal key={orderId} orderId={orderId} onClose={() => setOrderId(null)} />}
      {printer.portal}
    </>
  )
}
