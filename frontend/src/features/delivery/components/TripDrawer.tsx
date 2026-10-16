import { useState } from 'react'
import { App, Button, Descriptions, Drawer, Form, Input, InputNumber, Popconfirm, Space, Tag, Typography } from 'antd'
import { MapPin, Phone, Truck } from 'lucide-react'
import { currency } from '../../../shared/utils/format'
import { AdvanceStatusButton } from '../../orders/components/AdvanceStatusButton'
import { OrderDetailsModal } from '../../orders/components/OrderDetailsModal'
import { OrderStatusTag } from '../../orders/components/OrderStatusTag'
import { amountDue, jugCount } from '../../orders/types'
import { useOrders } from '../../orders/useOrders'
import type { SettlementDraft } from '../types'
import { useTripAction, useTrips } from '../useTrips'
import { TripStatusTag } from './TripStatusTag'

/** Chi tiết chuyến: danh sách điểm giao, ghi kết quả từng đơn và đối soát tiền/vỏ khi về. */
export function TripDrawer({ tripId, onClose }: { tripId: string; onClose: () => void }) {
  const { message } = App.useApp()
  const { data: trips = [] } = useTrips()
  const { data: orders = [] } = useOrders()
  const action = useTripAction()
  const [form] = Form.useForm<SettlementDraft>()
  const [orderId, setOrderId] = useState<string | null>(null)
  const cash = Form.useWatch('cashHandedOver', form)
  const bottles = Form.useWatch('bottlesHandedOver', form)
  const trip = trips.find((item) => item.id === tripId)
  if (!trip) return null

  const stops = trip.orderIds.map((id) => orders.find((order) => order.id === id)).filter((order) => order !== undefined)
  const done = stops.filter((order) => order.status !== 'Đang giao' && trip.departedAt).length
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
        extra={<TripStatusTag status={trip.status} />}
      >
        {trip.status === 'Chờ xuất phát' && (
          <Space className="af-detail-actions" wrap>
            <Button type="primary" loading={action.isPending} onClick={() => run({ kind: 'depart', id: trip.id }, `Chuyến ${trip.id} đã xuất phát.`)}>
              Xuất phát
            </Button>
            <Popconfirm title="Hủy chuyến này?" description="Các đơn trở lại danh sách chờ xếp chuyến." okText="Hủy chuyến" cancelText="Giữ" onConfirm={() => run({ kind: 'cancel', id: trip.id }, 'Đã hủy chuyến.', true)}>
              <Button danger>Hủy chuyến</Button>
            </Popconfirm>
          </Space>
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
                  <OrderStatusTag status={order.status} method={order.method} />
                </div>
                <strong>{order.customer}</strong>
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
                    {jugCount(order) ? `${jugCount(order)} bình · ` : ''}thu {currency(amountDue(order))}
                    {order.bottles ? ` · vỏ về ${order.bottles.returned}` : ''}
                  </small>
                  {trip.status === 'Chờ xuất phát' ? (
                    <Button size="small" type="text" danger onClick={() => run({ kind: 'removeOrder', id: trip.id, orderId: order.id }, `Đã bỏ ${order.id} khỏi chuyến.`)}>
                      Bỏ khỏi chuyến
                    </Button>
                  ) : (
                    order.status === 'Đang giao' && <AdvanceStatusButton order={order} />
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
              onFinish={(draft) => run({ kind: 'settle', id: trip.id, draft }, `Đã đối soát chuyến ${trip.id}.`)}
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
                    {currency(trip.settlement.cashHandedOver)} / sổ {currency(trip.settlement.cashExpected)}{' '}
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
    </>
  )
}
