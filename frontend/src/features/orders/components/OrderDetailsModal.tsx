import { useState } from 'react'
import { Alert, App, Button, Checkbox, Descriptions, Divider, Dropdown, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Timeline, Tooltip, Typography, theme } from 'antd'
import { Printer } from 'lucide-react'
import { Money } from '../../../shared/components/Money'
import { OrderTotals } from '../../../shared/components/OrderTotals'
import { TransferQr } from '../../../shared/payment/TransferQr'
import { dueTone } from '../../../shared/utils/money'
import { usePrinter } from '../../../shared/print/usePrinter'
import { currency } from '../../../shared/utils/format'
import { can } from '../../auth/permissions'
import { useStaff } from '../../auth/useStaff'
import { useSettings } from '../../settings/settingsService'
import { canCancel as cancellable, returnableQuantity } from '../orderService'
import { DeliverySlipDocument, InvoiceDocument } from '../print/OrderDocuments'
import { amountDue, awaitingReturnInspection, paidAmount, paymentLabel, returnedValue, type OrderLine, type Payment, type PaymentDraft, type RefundDraft } from '../types'
import { useOrderAction, useOrders } from '../useOrders'
import { AdvanceStatusButton } from './AdvanceStatusButton'
import { LateTag } from './LateTag'
import { OrderStatusTag } from './OrderStatusTag'

type ReturnForm = { quantities: Record<string, number | null>; reason: string; restock: boolean; refundMethod?: Payment['method']; refundReference?: string }
const paymentMethods = ['Tiền mặt', 'Chuyển khoản'].map((value) => ({ value, label: value }))

export function OrderDetailsModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const { data: orders = [] } = useOrders()
  const action = useOrderAction()
  const staff = useStaff()
  const [mode, setMode] = useState<'pay' | 'cancel' | 'return' | null>(null)
  const [paymentForm] = Form.useForm<PaymentDraft>()
  const [cancelForm] = Form.useForm<{ reason: string } & Partial<RefundDraft>>()
  const [returnForm] = Form.useForm<ReturnForm>()
  const paymentMethod = Form.useWatch('method', paymentForm)
  const paymentAmount = Form.useWatch('amount', paymentForm)
  const cancelRefundMethod = Form.useWatch('method', cancelForm)
  const returnValues = Form.useWatch([], returnForm)
  const { data: settings } = useSettings()
  const printer = usePrinter()
  const order = orders.find((item) => item.id === orderId)
  if (!order) return null
  const role = staff?.role ?? 'SALES_STAFF'
  const due = amountDue(order)
  const paid = paidAmount(order)
  const cancelled = order.status === 'Đã hủy'
  const canPay = !['Chờ xác nhận', 'Đã hủy', 'Đã hoàn tất'].includes(order.status) && due > 0
  const canCancel = cancellable(order) && !awaitingReturnInspection(order) && can(role, 'cancelOrder')
  const needsRefundRight = paid > 0 && !can(role, 'refund')
  const canReturn = ['Đã giao', 'Đã hoàn tất'].includes(order.status) && can(role, 'refund') && order.lines.some((line) => returnableQuantity(order, line.productId) > 0)
  // Giá trị hàng trả và số phải hoàn tính ngay khi nhập, giống cách backend sẽ tính.
  const returnValue = order.lines.reduce((sum, line) => sum + (returnValues?.quantities?.[line.productId] ?? 0) * line.unitPrice, 0)
  const returnRefund = Math.max(0, paid - (order.total - returnValue))
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
          <LateTag order={order} />
          <AdvanceStatusButton order={order} />
          {canPay && (
            <Button type="primary" onClick={() => setMode('pay')}>
              Ghi nhận thanh toán
            </Button>
          )}
          {canCancel && (
            <Tooltip title={needsRefundRight ? 'Đơn đã thu tiền: cần chủ cửa hàng hủy và hoàn tiền.' : undefined}>
              <Button danger disabled={needsRefundRight} onClick={() => setMode('cancel')}>
                Hủy đơn
              </Button>
            </Tooltip>
          )}
          {canReturn && <Button onClick={() => setMode('return')}>Nhận trả hàng</Button>}
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                { key: 'invoice', label: 'Hóa đơn bán lẻ', onClick: () => printer.print(<InvoiceDocument order={order} settings={settings} />) },
                ...(order.method === 'Giao tận nơi'
                  ? [{ key: 'slip', label: 'Phiếu giao hàng', onClick: () => printer.print(<DeliverySlipDocument order={order} settings={settings} />) }]
                  : []),
              ],
            }}
          >
            <Button icon={<Printer size={15} />}>In</Button>
          </Dropdown>
        </Space>
        {order.status === 'Đang giao' && can(role, 'cancelOrder') && (
          <Alert
            className="af-detail-alert"
            type="info"
            showIcon
            title="Muốn hủy đơn đang giao?"
            description="Tài xế ghi kết quả “Giao thất bại”, kho kiểm hàng mang về rồi mới hủy được."
          />
        )}
        {awaitingReturnInspection(order) && (
          <Alert
            className="af-detail-alert"
            type="warning"
            showIcon
            title="Chờ kiểm hàng hoàn"
            description="Kiểm hàng mang về ở Kho hàng → Hàng hoàn. Xong mới giao lại hoặc hủy đơn."
          />
        )}
        <Descriptions
          size="small"
          title="Thông tin giao nhận"
          column={{ xs: 1, sm: 2, md: 2, lg: 2, xl: 2, xxl: 2 }}
          items={[
            { key: 'customer', label: 'Khách hàng', children: order.customer },
            { key: 'phone', label: 'Điện thoại', children: order.phone || 'Không cung cấp' },
            { key: 'method', label: 'Nhận hàng', children: order.method },
            { key: 'channel', label: 'Kênh tiếp nhận', children: order.channel },
            { key: 'address', label: 'Địa chỉ đã lưu', children: order.floor ? `${order.address} · lầu ${order.floor} (thang bộ)` : order.address, span: 'filled' as const },
            {
              key: 'time',
              label: 'Giờ hẹn',
              children: order.appointment ? new Date(order.appointment).toLocaleString('vi-VN') : 'Chưa hẹn giờ cụ thể',
            },
            {
              key: 'delivered',
              label: 'Khách nhận lúc',
              children: order.deliveredAt ? new Date(order.deliveredAt).toLocaleString('vi-VN') : '—',
            },
            { key: 'note', label: 'Ghi chú', children: order.note || '—', span: 'filled' as const },
            ...(order.bottles
              ? [
                  {
                    key: 'bottles',
                    label: 'Vỏ bình',
                    span: 'filled' as const,
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
        <OrderTotals
          rows={[
            { label: 'Tiền hàng', value: currency(order.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)) },
            ...(order.method === 'Giao tận nơi' ? [{ label: 'Phí giao', value: order.deliveryFee > 0 ? currency(order.deliveryFee) : 'Miễn phí' }] : []),
            ...(order.returns?.length ? [{ label: 'Hàng khách trả lại', value: `−${currency(returnedValue(order))}` }] : []),
          ]}
          total={{ label: 'Tổng cộng', value: currency(order.total) }}
          after={cancelled ? (
            <div className="is-status"><Tag>Đã hủy</Tag></div>
          ) : (
            <>
              <div className="is-after-total">
                <dt>Đã thu</dt>
                <dd><Money value={paid} tone={paid > 0 ? 'paid' : 'neutral'} /></dd>
              </div>
              <div>
                <dt>Còn phải thu</dt>
                <dd><strong><Money value={due} tone={dueTone(due)} /></strong></dd>
              </div>
            </>
          )}
        />
        <Divider style={{ marginBlock: 16 }} />
        <Typography.Title level={5}>Lịch sử thanh toán</Typography.Title>
        {order.payments.length ? (
          <Table<Payment>
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={order.payments}
            scroll={{ x: 560 }}
            columns={[
              { title: 'Phiếu', dataIndex: 'id', render: (id: string, payment) => (payment.refund ? <Space size={4}>{id}<Tag color="volcano">Hoàn</Tag></Space> : id) },
              { title: 'Phương thức', dataIndex: 'method' },
              {
                title: 'Số tiền',
                dataIndex: 'amount',
                align: 'right',
                render: (amount: number, payment) => (payment.refund ? <span style={{ color: token.colorErrorText }}>−{currency(amount)}</span> : currency(amount)),
              },
              {
                title: 'Thời điểm / tham chiếu',
                key: 'detail',
                render: (_, payment) => (
                  <div className="af-cell-stack">
                    <span>{new Date(payment.recordedAt).toLocaleString('vi-VN')}</span>
                    <small>
                      {payment.reference || 'Tiền mặt'}
                      {payment.by ? ` · ${payment.by}` : ''}
                    </small>
                  </div>
                ),
              },
            ]}
          />
        ) : (
          <Typography.Paragraph type="secondary">Chưa ghi nhận khoản thanh toán.</Typography.Paragraph>
        )}
        {order.returns?.length ? (
          <>
            <Divider style={{ marginBlock: 16 }} />
            <Typography.Title level={5}>Hàng trả lại</Typography.Title>
            <ul className="af-return-list">
              {order.returns.map((item) => (
                <li key={item.id}>
                  <strong>{item.lines.map((line) => `${line.quantity} ${line.unit.toLowerCase()} ${line.name}`).join(', ')}</strong>
                  <span>
                    {item.reason} · {item.restocked ? 'Nhập lại kho' : 'Loại bỏ (hỏng)'}
                    {item.refunded ? ` · Hoàn ${currency(item.refunded)}` : ''}
                  </span>
                  <small>
                    {new Date(item.at).toLocaleString('vi-VN')}
                    {item.by ? ` · ${item.by}` : ''}
                  </small>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <Divider style={{ marginBlock: 16 }} />
        <Typography.Title level={5}>Lịch sử xử lý đơn</Typography.Title>
        <Timeline
          items={[...order.history].reverse().map((event, index) => ({
            key: index,
            content: (
              <>
                <div>{event.message}</div>
                <Typography.Text type="secondary">
                  {new Date(event.at).toLocaleString('vi-VN')}
                  {event.by ? ` · ${event.by}` : ''}
                </Typography.Text>
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
            <Select options={paymentMethods} />
          </Form.Item>
          {paymentMethod === 'Chuyển khoản' && (
            <>
              <TransferQr settings={settings} amount={paymentAmount && paymentAmount > 0 ? paymentAmount : due} note={order.id} />
              <Form.Item
                name="reference"
                label="Mã tham chiếu chuyển khoản"
                tooltip="Mã giao dịch trong ứng dụng ngân hàng của cửa hàng, sau khi thấy tiền vào."
                rules={[{ required: true, whitespace: true, message: 'Nhập mã tham chiếu.' }]}
                style={{ marginTop: 12 }}
              >
                <Input />
              </Form.Item>
            </>
          )}
          <p className="af-form-hint">
            Chỉ xác nhận sau khi đã nhận tiền mặt hoặc kiểm tra tiền vào tài khoản. Khoản cọc vỏ không được gộp vào phiếu thu tiền hàng.
          </p>
        </Form>
      </Modal>
      <Modal
        open={mode === 'cancel'}
        title={`Hủy đơn ${order.id}`}
        okText={paid > 0 ? `Hủy và hoàn ${currency(paid)}` : 'Xác nhận hủy đơn'}
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
          initialValues={{ method: 'Tiền mặt' }}
          onFinish={({ reason, method, reference }) =>
            action.mutate({ kind: 'cancel', id: order.id, reason, refund: paid > 0 && method ? { method, reference } : undefined }, callbacks)
          }
        >
          <p>{order.status === 'Giao thất bại' ? 'Hàng mang về đã được xử lý khi kiểm hàng hoàn.' : 'Hàng đang giữ cho đơn sẽ được trả lại số lượng có thể bán.'}</p>
          {paid > 0 && (
            <>
              <Alert type="warning" showIcon title={`Đơn đã thu ${currency(paid)}. Hủy đơn sẽ ghi phiếu hoàn toàn bộ số này cho khách.`} style={{ marginBottom: 16 }} />
              <Form.Item name="method" label="Cách hoàn tiền" rules={[{ required: true }]}>
                <Select options={paymentMethods} />
              </Form.Item>
              {cancelRefundMethod === 'Chuyển khoản' && (
                <Form.Item name="reference" label="Mã giao dịch hoàn tiền" rules={[{ required: true, whitespace: true, message: 'Nhập mã giao dịch.' }]}>
                  <Input />
                </Form.Item>
              )}
            </>
          )}
          <Form.Item name="reason" label="Lý do hủy" rules={[{ required: true, whitespace: true, message: 'Nhập lý do hủy.' }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        open={mode === 'return'}
        title={`Nhận trả hàng · ${order.id}`}
        okText={returnRefund > 0 ? `Nhận trả và hoàn ${currency(returnRefund)}` : 'Nhận trả hàng'}
        cancelText="Đóng"
        onCancel={() => setMode(null)}
        onOk={() => returnForm.submit()}
        okButtonProps={{ disabled: returnValue <= 0 }}
        confirmLoading={action.isPending}
        destroyOnHidden
        width={620}
      >
        <Form<ReturnForm>
          form={returnForm}
          layout="vertical"
          preserve={false}
          initialValues={{ restock: true, refundMethod: 'Tiền mặt', quantities: {} }}
          onFinish={(values) =>
            action.mutate(
              {
                kind: 'return',
                id: order.id,
                draft: {
                  lines: order.lines.map((line) => ({ productId: line.productId, quantity: values.quantities?.[line.productId] ?? 0 })),
                  reason: values.reason,
                  restock: values.restock,
                  refundMethod: returnRefund > 0 ? values.refundMethod : undefined,
                  refundReference: values.refundReference,
                },
              },
              callbacks,
            )
          }
        >
          <div className="af-return-lines">
            {order.lines.map((line) => {
              const max = returnableQuantity(order, line.productId)
              return (
                <Form.Item key={line.productId} name={['quantities', line.productId]} label={`${line.name} (còn trả được ${max})`}>
                  <InputNumber min={0} max={max} precision={0} disabled={!max} suffix={line.unit.toLowerCase()} style={{ width: '100%' }} />
                </Form.Item>
              )
            })}
          </div>
          <Form.Item name="restock" valuePropName="checked">
            <Checkbox>Hàng còn nguyên, nhập lại tồn bán được (bỏ chọn nếu hàng hỏng)</Checkbox>
          </Form.Item>
          <Form.Item name="reason" label="Lý do trả" rules={[{ required: true, whitespace: true, message: 'Nhập lý do trả hàng.' }]}>
            <Input.TextArea rows={2} placeholder="Ví dụ: bình rò nước, giao nhầm loại" />
          </Form.Item>
          <div className="af-order-summary">
            <span>Giá trị hàng trả</span>
            <strong>{currency(returnValue)}</strong>
          </div>
          <div className="af-order-summary">
            <span>Phải hoàn cho khách</span>
            <strong>{currency(returnRefund)}</strong>
          </div>
          {returnRefund > 0 && (
            <Space wrap style={{ marginTop: 12 }}>
              <Form.Item name="refundMethod" label="Cách hoàn tiền" rules={[{ required: true }]}>
                <Select options={paymentMethods} style={{ minWidth: 160 }} />
              </Form.Item>
              {returnValues?.refundMethod === 'Chuyển khoản' && (
                <Form.Item name="refundReference" label="Mã giao dịch hoàn tiền" rules={[{ required: true, whitespace: true, message: 'Nhập mã giao dịch.' }]}>
                  <Input />
                </Form.Item>
              )}
            </Space>
          )}
          <p className="af-form-hint">Giá trị đơn giảm theo hàng trả. Chỉ hoàn phần khách đã trả vượt giá trị mới của đơn.</p>
        </Form>
      </Modal>
      {printer.portal}
    </>
  )
}
