import { useState } from 'react'
import {
  Alert,
  App,
  Button,
  Checkbox,
  Collapse,
  Descriptions,
  Dropdown,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Timeline,
  Tooltip,
  Typography,
  theme,
  type CollapseProps,
} from 'antd'
import { Ellipsis } from 'lucide-react'
import { Money } from '@/shared/components/Money'
import { OrderTotals } from '@/shared/components/OrderTotals'
import { TransferQr } from '@/shared/payment/TransferQr'
import { dueTone } from '@/shared/utils/money'
import { usePrinter } from '@/shared/print/usePrinter'
import { currency } from '@/shared/utils/format'
import { can } from '@/features/auth/permissions'
import { useStaff } from '@/features/auth/useStaff'
import { useSettings } from '@/features/settings/settingsService'
import { canCancel as cancellable, returnableQuantity } from '../orderService'
import { demoOrderFocus } from '../orderFocus'
import { nextActionLabel } from '../orderStatus'
import { DeliverySlipDocument, InvoiceDocument } from '../print/OrderDocuments'
import { useCopyOrderMessage } from '../useCopyOrderMessage'
import { OrderFocusBanner, OrderLines, OrderParty } from './OrderSheet'
import { modalScrollBody, modalWidth } from '@/shared/utils/modal'
import {
  amountDue,
  awaitingReturnInspection,
  paidAmount,
  returnedValue,
  type Payment,
  type PaymentDraft,
  type RefundDraft,
} from '../types'
import { useOrderAction, useOrders } from '../useOrders'
import { AdvanceStatusButton } from './AdvanceStatusButton'
import { LateTag } from './LateTag'
import { OrderStatusTag } from './OrderStatusTag'

type ReturnForm = {
  quantities: Record<string, number | null>
  reason: string
  restock: boolean
  refundMethod?: Payment['method']
  refundReference?: string
}
const paymentMethods = ['Tiền mặt', 'Chuyển khoản'].map((value) => ({ value, label: value }))

/** `payOnly`: chỉ mở hộp ghi nhận thanh toán (màn hình tài xế), không hiện chi tiết và thao tác quản lý. */
export function OrderDetailsModal({ orderId, onClose, payOnly = false }: { orderId: string; onClose: () => void; payOnly?: boolean }) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const { data: orders = [] } = useOrders()
  const action = useOrderAction()
  const staff = useStaff()
  const [mode, setMode] = useState<'pay' | 'cancel' | 'return' | null>(payOnly ? 'pay' : null)
  const [paymentForm] = Form.useForm<PaymentDraft>()
  const [cancelForm] = Form.useForm<{ reason: string } & Partial<RefundDraft>>()
  const [returnForm] = Form.useForm<ReturnForm>()
  const paymentMethod = Form.useWatch('method', paymentForm)
  const paymentAmount = Form.useWatch('amount', paymentForm)
  const cancelRefundMethod = Form.useWatch('method', cancelForm)
  const returnValues = Form.useWatch([], returnForm)
  const { data: settings } = useSettings()
  const printer = usePrinter()
  const copyMessage = useCopyOrderMessage()
  const order = orders.find((item) => item.id === orderId)
  if (!order) return null
  const role = staff?.role ?? 'SALES_STAFF'
  const due = amountDue(order)
  const paid = paidAmount(order)
  const cancelled = order.status === 'Đã hủy'
  const canPay = !['Chờ xác nhận', 'Đã hủy', 'Đã hoàn tất'].includes(order.status) && due > 0
  const canCancel = cancellable(order) && !awaitingReturnInspection(order) && can(role, 'cancelOrder')
  const needsRefundRight = paid > 0 && !can(role, 'refund')
  const canReturn =
    ['Đã giao', 'Đã hoàn tất'].includes(order.status) &&
    can(role, 'refund') &&
    order.lines.some((line) => returnableQuantity(order, line.productId) > 0)
  // Giá trị hàng trả và số phải hoàn tính ngay khi nhập, giống cách backend sẽ tính.
  const returnValue = order.lines.reduce((sum, line) => sum + (returnValues?.quantities?.[line.productId] ?? 0) * line.unitPrice, 0)
  const returnRefund = Math.max(0, paid - (order.total - returnValue))
  const callbacks = {
    onSuccess: () => {
      message.success('Đã cập nhật đơn hàng.')
      if (payOnly) onClose()
      else setMode(null)
    },
    onError: (error: Error) => message.error(error.message),
  }

  const hasAdvance = Boolean(nextActionLabel(order))
  const moreMenu = [
    ...(cancelled ? [] : [{ key: 'copy', label: 'Sao chép tin nhắn xác nhận', onClick: () => void copyMessage(order, settings?.storeName) }]),
    { key: 'invoice', label: 'In hóa đơn bán lẻ', onClick: () => printer.print(<InvoiceDocument order={order} settings={settings} />) },
    ...(order.method === 'Giao tận nơi'
      ? [{ key: 'slip', label: 'In phiếu giao hàng', onClick: () => printer.print(<DeliverySlipDocument order={order} settings={settings} />) }]
      : []),
    ...(canReturn ? [{ key: 'return', label: 'Nhận trả hàng', onClick: () => setMode('return') }] : []),
  ]
  const moreSections: CollapseProps['items'] = [
    {
      key: 'payments',
      label: 'Thanh toán',
      extra: order.payments.length ? `${order.payments.length} phiếu` : 'Chưa có phiếu',
      children: order.payments.length ? (
        <Table<Payment>
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={order.payments}
          scroll={{ x: 560 }}
          columns={[
            {
              title: 'Phiếu',
              dataIndex: 'id',
              render: (id: string, payment) =>
                payment.refund ? (
                  <Space size={4}>
                    {id}
                    <Tag color="volcano">Hoàn</Tag>
                  </Space>
                ) : (
                  id
                ),
            },
            { title: 'Phương thức', dataIndex: 'method' },
            {
              title: 'Số tiền',
              dataIndex: 'amount',
              align: 'right',
              render: (amount: number, payment) =>
                payment.refund ? <span style={{ color: token.colorErrorText }}>−{currency(amount)}</span> : currency(amount),
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
        <p className="af-order-more-empty">Chưa ghi nhận khoản thanh toán.</p>
      ),
    },
    ...(order.returns?.length
      ? [
          {
            key: 'returns',
            label: 'Hàng trả lại',
            extra: `${order.returns.length} lần`,
            children: (
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
            ),
          },
        ]
      : []),
    {
      key: 'history',
      label: 'Lịch sử xử lý',
      extra: `${order.history.length} mốc`,
      children: (
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
      ),
    },
    {
      key: 'info',
      label: 'Thông tin đơn',
      extra: order.channel,
      children: (
        <Descriptions
          size="small"
          column={{ xs: 1, sm: 2 }}
          items={[
            { key: 'channel', label: 'Kênh tiếp nhận', children: order.channel },
            ...(order.deliveredAt
              ? [{ key: 'delivered', label: 'Khách nhận lúc', children: new Date(order.deliveredAt).toLocaleString('vi-VN') }]
              : []),
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
      ),
    },
  ]

  return (
    <>
      <Modal
        open={!payOnly}
        centered
        className="af-order-details"
        onCancel={onClose}
        width={modalWidth.medium}
        styles={modalScrollBody}
        title={
          <span className="af-order-title">
            <span>Đơn {order.code ?? order.id}</span>
            <OrderStatusTag status={order.status} method={order.method} />
            <LateTag order={order} />
          </span>
        }
        footer={
          <div className="af-order-footer">
            <div>
              {canCancel && (
                <Tooltip title={needsRefundRight ? 'Đơn đã thu tiền: cần chủ cửa hàng hủy và hoàn tiền.' : undefined}>
                  <Button type="text" danger disabled={needsRefundRight} onClick={() => setMode('cancel')}>
                    Hủy đơn
                  </Button>
                </Tooltip>
              )}
            </div>
            <div>
              <Dropdown trigger={['click']} menu={{ items: moreMenu }}>
                <Button icon={<Ellipsis size={16} />}>Thao tác khác</Button>
              </Dropdown>
              {canPay && (
                <Button type={hasAdvance ? 'default' : 'primary'} onClick={() => setMode('pay')}>
                  Ghi nhận thanh toán
                </Button>
              )}
              {hasAdvance && <AdvanceStatusButton order={order} size="middle" primary />}
            </div>
          </div>
        }
      >
        <OrderFocusBanner focus={demoOrderFocus(order)} />
        <div className="af-order-sheet">
          <OrderParty order={order} />
          <OrderLines lines={order.lines}>
            <OrderTotals
              wide
              rows={[
                { label: 'Tiền hàng', value: currency(order.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)) },
                ...(order.method === 'Giao tận nơi'
                  ? [{ label: 'Phí giao', value: order.deliveryFee > 0 ? currency(order.deliveryFee) : 'Miễn phí' }]
                  : []),
                ...(order.returns?.length ? [{ label: 'Hàng khách trả lại', value: `−${currency(returnedValue(order))}` }] : []),
              ]}
              total={{ label: 'Tổng cộng', value: currency(order.total) }}
              after={
                cancelled ? null : (
                  <>
                    <div className="is-after-total">
                      <dt>Đã thu</dt>
                      <dd>
                        <Money value={paid} tone={paid > 0 ? 'paid' : 'neutral'} />
                      </dd>
                    </div>
                    <div>
                      <dt>Còn phải thu</dt>
                      <dd>
                        <strong>
                          <Money value={due} tone={dueTone(due)} />
                        </strong>
                      </dd>
                    </div>
                  </>
                )
              }
            />
          </OrderLines>
        </div>
        <Collapse ghost className="af-order-more" items={moreSections} />
      </Modal>
      <Modal
        open={mode === 'pay'}
        centered
        title={payOnly ? `Thu tiền · ${order.id}` : 'Ghi nhận thanh toán'}
        okText="Xác nhận đã nhận tiền"
        cancelText="Hủy"
        width={modalWidth.small}
        onCancel={() => (payOnly ? onClose() : setMode(null))}
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
            rules={[
              { required: true },
              { type: 'integer', min: 1, max: due, message: 'Số tiền phải dương và không vượt số còn phải thu.' },
            ]}
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
        width={modalWidth.small}
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
            action.mutate(
              { kind: 'cancel', id: order.id, reason, refund: paid > 0 && method ? { method, reference } : undefined },
              callbacks,
            )
          }
        >
          <p>
            {order.status === 'Giao thất bại'
              ? 'Hàng mang về đã được xử lý khi kiểm hàng hoàn.'
              : 'Hàng đang giữ cho đơn sẽ được trả lại số lượng có thể bán.'}
          </p>
          {paid > 0 && (
            <>
              <Alert
                type="warning"
                showIcon
                title={`Đơn đã thu ${currency(paid)}. Hủy đơn sẽ ghi phiếu hoàn toàn bộ số này cho khách.`}
                style={{ marginBottom: 16 }}
              />
              <Form.Item name="method" label="Cách hoàn tiền" rules={[{ required: true }]}>
                <Select options={paymentMethods} />
              </Form.Item>
              {cancelRefundMethod === 'Chuyển khoản' && (
                <Form.Item
                  name="reference"
                  label="Mã giao dịch hoàn tiền"
                  rules={[{ required: true, whitespace: true, message: 'Nhập mã giao dịch.' }]}
                >
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
        cancelText="Hủy"
        onCancel={() => setMode(null)}
        onOk={() => returnForm.submit()}
        okButtonProps={{ disabled: returnValue <= 0 }}
        confirmLoading={action.isPending}
        destroyOnHidden
        width={modalWidth.small}
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
                <Form.Item
                  name="refundReference"
                  label="Mã giao dịch hoàn tiền"
                  rules={[{ required: true, whitespace: true, message: 'Nhập mã giao dịch.' }]}
                >
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
