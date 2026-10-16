import { useState } from 'react'
import { App, Button, Descriptions, Divider, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Timeline, Typography, theme } from 'antd'
import { currency } from '../../../shared/utils/format'
import { amountDue, paidAmount, paymentLabel, type OrderLine, type PaymentDraft } from '../types'
import { useOrderAction, useOrders } from '../useOrders'
import { AdvanceStatusButton } from './AdvanceStatusButton'
import { OrderStatusTag } from './OrderStatusTag'

export function OrderDetailsModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const { data: orders = [] } = useOrders()
  const action = useOrderAction()
  const [mode, setMode] = useState<'pay' | 'cancel' | null>(null)
  const [paymentForm] = Form.useForm<PaymentDraft>()
  const [cancelForm] = Form.useForm<{ reason: string }>()
  const paymentMethod = Form.useWatch('method', paymentForm)
  const order = orders.find((item) => item.id === orderId)
  if (!order) return null
  const due = amountDue(order)
  const paid = paidAmount(order)
  const cancelled = order.status === 'Đã hủy'
  const dueColor = cancelled ? undefined : due > 0 ? token.colorWarningText : token.colorSuccessText
  const dueBackground = cancelled ? undefined : due > 0 ? token.colorWarningBg : token.colorSuccessBg
  const canPay = !['Chờ xác nhận', 'Đã hủy', 'Đã hoàn tất'].includes(order.status) && due > 0
  const canCancel = ['Chờ xác nhận', 'Đang chuẩn bị'].includes(order.status) && order.payments.length === 0
  const callbacks = {
    onSuccess: () => {
      message.success('Đã cập nhật đơn hàng.')
      setMode(null)
    },
    onError: (error: Error) => message.error(error.message),
  }

  return (
    <>
      <Modal
        open
        centered
        className="af-order-details"
        onCancel={onClose}
        width={900}
        footer={null}
        title={`Chi tiết đơn ${order.id}`}
        styles={{ body: { maxHeight: 'calc(100dvh - 180px)', overflowY: 'auto', paddingTop: 12, paddingRight: 8 } }}
      >
        <Space wrap className="af-detail-actions">
          <OrderStatusTag status={order.status} method={order.method} />
          <Tag color={due === 0 ? 'green' : 'orange'}>{paymentLabel(order)}</Tag>
          <AdvanceStatusButton order={order} />
          {canPay && (
            <Button type="primary" onClick={() => setMode('pay')}>
              Ghi nhận thanh toán
            </Button>
          )}
          {canCancel && (
            <Button danger onClick={() => setMode('cancel')}>
              Hủy đơn
            </Button>
          )}
        </Space>
        <Descriptions
          size="small"
          title="Thông tin giao nhận"
          column={{ xs: 1, sm: 2 }}
          items={[
            { key: 'customer', label: 'Khách hàng', children: order.customer },
            { key: 'phone', label: 'Điện thoại', children: order.phone || 'Không cung cấp' },
            { key: 'method', label: 'Nhận hàng', children: order.method },
            { key: 'channel', label: 'Kênh tiếp nhận', children: order.channel },
            { key: 'address', label: 'Địa chỉ đã lưu', children: order.floor ? `${order.address} · lầu ${order.floor} (thang bộ)` : order.address, span: 2 },
            {
              key: 'time',
              label: 'Giờ hẹn',
              children: order.appointment ? new Date(order.appointment).toLocaleString('vi-VN') : 'Chưa hẹn giờ cụ thể',
              span: 2,
            },
            { key: 'note', label: 'Ghi chú', children: order.note || '—', span: 2 },
            ...(order.bottles
              ? [
                  {
                    key: 'bottles',
                    label: 'Vỏ bình',
                    span: 2,
                    children: `Giao ${order.bottles.delivered} · Thu về ${order.bottles.returned}${order.bottles.deposit ? ` · Thu cọc ${currency(order.bottles.deposit)} (sổ cọc, ngoài tiền hàng)` : ''}`,
                  },
                ]
              : []),
          ]}
        />
        <Divider style={{ marginBlock: 16 }} />
        <Typography.Title level={5}>{order.status === 'Chờ xác nhận' ? 'Sản phẩm & giá dự kiến' : 'Sản phẩm & giá đã chốt'}</Typography.Title>
        <Table<OrderLine>
          rowKey="productId"
          size="small"
          pagination={false}
          dataSource={order.lines}
          scroll={{ x: 500 }}
          columns={[
            { title: 'Sản phẩm', dataIndex: 'name' },
            { title: 'SL', dataIndex: 'quantity', width: 55, align: 'right' },
            { title: 'Đơn giá', dataIndex: 'unitPrice', align: 'right', render: currency },
            { title: 'Thành tiền', key: 'total', align: 'right', render: (_, line) => currency(line.quantity * line.unitPrice) },
          ]}
        />
        <div className="af-order-summary">
          <span>Phí giao hàng</span>
          <span>{currency(order.deliveryFee)}</span>
        </div>
        <div className="af-order-summary af-order-summary-highlight">
          <span>Tổng tiền hàng & giao hàng</span>
          <strong style={{ color: token.colorPrimaryText }}>{currency(order.total)}</strong>
        </div>
        <div className="af-order-summary">
          <span>Đã thu</span>
          <span style={{ color: paid > 0 ? token.colorSuccessText : undefined, fontWeight: paid > 0 ? 600 : undefined }}>{currency(paid)}</span>
        </div>
        <div className="af-order-summary" style={{ background: dueBackground }}>
          <span>Còn phải thu</span>
          <strong style={{ color: dueColor }}>{cancelled ? '—' : currency(due)}</strong>
        </div>
        <Divider style={{ marginBlock: 16 }} />
        <Typography.Title level={5}>Lịch sử thanh toán</Typography.Title>
        {order.payments.length ? (
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={order.payments}
            scroll={{ x: 500 }}
            columns={[
              { title: 'Phiếu thu', dataIndex: 'id' },
              { title: 'Phương thức', dataIndex: 'method' },
              { title: 'Số tiền', dataIndex: 'amount', align: 'right', render: currency },
              {
                title: 'Thời điểm / tham chiếu',
                key: 'detail',
                render: (_, payment) => (
                  <div className="af-cell-stack">
                    <span>{new Date(payment.recordedAt).toLocaleString('vi-VN')}</span>
                    <small>{payment.reference || 'Tiền mặt'}</small>
                  </div>
                ),
              },
            ]}
          />
        ) : (
          <Typography.Paragraph type="secondary">Chưa ghi nhận khoản thanh toán.</Typography.Paragraph>
        )}
        <Divider style={{ marginBlock: 16 }} />
        <Typography.Title level={5}>Lịch sử xử lý đơn</Typography.Title>
        <Timeline
          items={[...order.history].reverse().map((event, index) => ({
            key: index,
            content: (
              <>
                <div>{event.message}</div>
                <Typography.Text type="secondary">{new Date(event.at).toLocaleString('vi-VN')}</Typography.Text>
              </>
            ),
          }))}
        />
      </Modal>
      <Modal
        open={mode === 'pay'}
        title="Ghi nhận thanh toán"
        okText="Xác nhận đã nhận tiền"
        cancelText="Đóng"
        onCancel={() => setMode(null)}
        onOk={() => paymentForm.submit()}
        confirmLoading={action.isPending}
        destroyOnHidden
      >
        <Form
          form={paymentForm}
          layout="vertical"
          preserve={false}
          initialValues={{ amount: due, method: 'Tiền mặt' }}
          onFinish={(payment) => action.mutate({ kind: 'pay', id: order.id, payment }, callbacks)}
        >
          <Form.Item
            name="amount"
            label={`Số tiền nhận (còn ${currency(due)})`}
            rules={[{ required: true }, { type: 'integer', min: 1, max: due, message: 'Số tiền phải dương và không vượt số còn phải thu.' }]}
          >
            <InputNumber min={1} max={due} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="method" label="Phương thức" rules={[{ required: true }]}>
            <Select options={['Tiền mặt', 'Chuyển khoản'].map((value) => ({ value, label: value }))} />
          </Form.Item>
          {paymentMethod === 'Chuyển khoản' && (
            <Form.Item name="reference" label="Mã tham chiếu chuyển khoản" rules={[{ required: true, whitespace: true, message: 'Nhập mã tham chiếu.' }]}>
              <Input />
            </Form.Item>
          )}
          <p className="af-form-hint">
            Chỉ xác nhận sau khi đã nhận tiền mặt hoặc kiểm tra tiền vào tài khoản. Khoản cọc vỏ không được gộp vào phiếu thu tiền hàng.
          </p>
        </Form>
      </Modal>
      <Modal
        open={mode === 'cancel'}
        title={`Hủy đơn ${order.id}`}
        okText="Xác nhận hủy đơn"
        okButtonProps={{ danger: true }}
        cancelText="Giữ đơn"
        onCancel={() => setMode(null)}
        onOk={() => cancelForm.submit()}
        confirmLoading={action.isPending}
        destroyOnHidden
      >
        <Form
          form={cancelForm}
          layout="vertical"
          preserve={false}
          onFinish={({ reason }) => action.mutate({ kind: 'cancel', id: order.id, reason }, callbacks)}
        >
          <p>Hàng đang giữ cho đơn sẽ được trả lại số lượng có thể bán.</p>
          <Form.Item name="reason" label="Lý do hủy" rules={[{ required: true, whitespace: true, message: 'Nhập lý do hủy.' }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
