import { App, AutoComplete, Button, Col, Form, Input, InputNumber, Modal, Row, Select, Typography } from 'antd'
import { Plus, Trash2 } from 'lucide-react'
import { currency } from '../../../shared/utils/format'
import { FREE_DELIVERY_MIN_UNITS, SMALL_ORDER_FEE, stairsSurcharge, suggestedDeliveryFee } from '../../../shared/policy'
import { normalizePhone } from '../../customers/types'
import { useCustomers } from '../../customers/useCustomers'
import { daysUntilExpiry } from '../../inventory/expiry'
import { useProducts } from '../../inventory/useProducts'
import type { Order, OrderDraft } from '../types'
import { useCreateOrder } from '../useOrders'
import { useConfirmDiscard } from '../../../shared/hooks/useConfirmDiscard'

type CreateOrderModalProps = { open: boolean; onClose: () => void; onCreated?: (order: Order) => void; defaultCustomer?: string; defaultPhone?: string; defaultAddress?: string }

export function CreateOrderModal(props: CreateOrderModalProps) {
  return props.open ? <CreateOrderDialog {...props} /> : null
}

function CreateOrderDialog({ open, onClose, onCreated, defaultCustomer, defaultPhone, defaultAddress }: CreateOrderModalProps) {
  const { message } = App.useApp()
  const [form] = Form.useForm<OrderDraft>()
  const cancel = useConfirmDiscard(form, onClose)
  const { data: products = [], isPending: loadingProducts } = useProducts()
  const createOrder = useCreateOrder()
  const { data: customers = [] } = useCustomers()
  const sellable = products.filter((product) => product.sku !== 'VO-20L')
  const lines: OrderDraft['lines'] = Form.useWatch('lines', form) ?? []
  const method = Form.useWatch('method', form) ?? 'Giao tận nơi'
  const fee = Form.useWatch('deliveryFee', form) ?? 0
  const phone: string = Form.useWatch('phone', form) ?? ''
  const floor: number = Form.useWatch('floor', form) ?? 0
  const units = lines.reduce((sum, line) => sum + (line?.quantity ?? 0), 0)
  const jugs = lines.reduce((sum, line) => sum + (products.find((product) => product.id === line?.productId)?.unit === 'Bình' ? line?.quantity ?? 0 : 0), 0)
  const suggestedFee = suggestedDeliveryFee({ units, jugs, floor })
  // Khách đã có hồ sơ: gợi ý các địa chỉ giao đã lưu.
  const knownCustomer = phone ? customers.find((customer) => normalizePhone(customer.phone) === normalizePhone(phone)) : undefined
  const needsCustomer = method === 'Giao tận nơi' || lines.some((line) => products.find((product) => product.id === line?.productId)?.unit === 'Bình')
  const total = lines.reduce((sum, line) => sum + (products.find((product) => product.id === line?.productId)?.price ?? 0) * (line?.quantity ?? 0), 0)
  return (
    <Modal
      open={open}
      title="Tiếp nhận đơn hàng"
      width={740}
      style={{ top: 24 }}
      styles={{ body: { maxHeight: 'calc(100dvh - 200px)', overflowY: 'auto', paddingRight: 8 } }}
      okText="Tạo đơn chờ xác nhận"
      cancelText="Hủy"
      confirmLoading={createOrder.isPending}
      onOk={() => form.submit()}
      onCancel={cancel}
      destroyOnHidden
    >
      <Form<OrderDraft>
        form={form}
        layout="vertical"
        initialValues={{
          customer: defaultCustomer,
          phone: defaultPhone,
          address: defaultAddress,
          method: 'Giao tận nơi',
          channel: 'Điện thoại',
          deliveryFee: 0,
          floor: 0,
          lines: [{ quantity: 1 }],
        }}
        onFinish={(draft) =>
          createOrder.mutate(draft, {
            onSuccess: (order) => {
              message.success(`Đã tiếp nhận đơn ${order.id}.`)
              onClose()
              onCreated?.(order)
            },
            onError: (error) => message.error(error.message),
          })
        }
      >
        <div className="af-form-section-title">1. Khách hàng & nhận hàng</div>
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item name="method" label="Hình thức nhận" rules={[{ required: true }]}>
              <Select options={['Giao tận nơi', 'Tại quầy'].map((value) => ({ value, label: value }))} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="channel" label="Kênh tiếp nhận" rules={[{ required: true }]}>
              <Select options={['Tại quầy', 'Điện thoại', 'Tin nhắn', 'Website'].map((value) => ({ value, label: value }))} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="customer"
              label="Tên khách hàng"
              rules={[{ required: needsCustomer, whitespace: true, message: 'Nhập tên khách hàng.' }, { max: 100 }]}
            >
              <Input placeholder={needsCustomer ? 'Tên khách đặt nước' : 'Để trống nếu là khách vãng lai'} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="phone"
              label="Số điện thoại"
              rules={[
                { required: needsCustomer, message: 'Nhập số điện thoại.' },
                {
                  validator: (_, value) =>
                    !value || /^(?:0\d{9,10}|\+84\d{9,10})$/.test(value.replace(/[\s.-]/g, ''))
                      ? Promise.resolve()
                      : Promise.reject(new Error('Số điện thoại không hợp lệ.')),
                },
              ]}
            >
              <Input placeholder="Ví dụ: 0903456128" inputMode="tel" />
            </Form.Item>
          </Col>
        </Row>
        {method === 'Giao tận nơi' && (
          <>
            <Form.Item
              name="address"
              label="Địa chỉ giao hàng"
              rules={[{ required: true, whitespace: true, message: 'Nhập địa chỉ giao hàng.' }, { max: 255 }]}
            >
              <AutoComplete
                options={knownCustomer?.addresses.map((address) => ({ value: address }))}
                placeholder="Số nhà, tên đường, phường/xã, tỉnh/thành phố"
              />
            </Form.Item>
            {knownCustomer && (
              <p className="af-form-hint af-known-customer">
                Khách {knownCustomer.id} · đang giữ {knownCustomer.bottlesHeld} vỏ{knownCustomer.debt > 0 ? ` · còn nợ ${currency(knownCustomer.debt)}` : ''}
              </p>
            )}
            <Form.Item
              name="appointment"
              label="Giờ nhận mong muốn"
              rules={[
                {
                  validator: (_, value) =>
                    !value || Date.parse(value) > Date.now() ? Promise.resolve() : Promise.reject(new Error('Chọn thời gian trong tương lai.')),
                },
              ]}
            >
              <Input type="datetime-local" />
            </Form.Item>
          </>
        )}
        <div className="af-form-section-title">2. Sản phẩm đặt mua</div>
        <Form.List
          name="lines"
          rules={[{ validator: (_, value) => (value?.length ? Promise.resolve() : Promise.reject(new Error('Thêm ít nhất một sản phẩm.'))) }]}
        >
          {(fields, { add, remove }, { errors }) => (
            <>
              {fields.map((field, index) => (
                <div className="af-order-line-form" key={field.key}>
                  <Form.Item name={[field.name, 'productId']} label={`Sản phẩm ${index + 1}`} rules={[{ required: true, message: 'Chọn sản phẩm.' }]}>
                    <Select
                      loading={loadingProducts}
                      showSearch={{ optionFilterProp: 'label' }}
                      placeholder="Chọn sản phẩm"
                      options={sellable.map((product) => ({
                        value: product.id,
                        label: `${product.name} · ${currency(product.price)} · còn ${product.stock}`,
                        disabled: product.stock === 0 || (daysUntilExpiry(product.expiry) ?? 0) < 0,
                      }))}
                    />
                  </Form.Item>
                  <Form.Item
                    name={[field.name, 'quantity']}
                    label="Số lượng"
                    rules={[
                      { required: true, message: 'Nhập số lượng.' },
                      { type: 'integer', min: 1, message: 'Nhập số nguyên dương.' },
                    ]}
                  >
                    <InputNumber min={1} precision={0} style={{ width: '100%' }} />
                  </Form.Item>
                  <Button
                    type="text"
                    danger
                    aria-label={`Xóa sản phẩm ${index + 1}`}
                    icon={<Trash2 size={17} />}
                    onClick={() => remove(field.name)}
                    disabled={fields.length === 1}
                  />
                </div>
              ))}
              <Form.ErrorList errors={errors} />
              <Button type="dashed" block icon={<Plus size={16} />} onClick={() => add({ quantity: 1 })}>
                Thêm sản phẩm
              </Button>
            </>
          )}
        </Form.List>
        <div className="af-form-section-title">3. Tổng tiền & ghi chú</div>
        {method === 'Giao tận nơi' && (
          <>
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item name="floor" label="Giao lên lầu (thang bộ)">
                  <Select
                    options={[
                      { value: 0, label: 'Tầng trệt / có thang máy' },
                      ...[1, 2, 3, 4].map((value) => ({ value, label: `Lầu ${value} · +${stairsSurcharge(value, 1).toLocaleString('vi-VN')} ₫/bình` })),
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item name="deliveryFee" label="Phí giao hàng (₫)" rules={[{ required: true }, { type: 'integer', min: 0 }]}>
                  <InputNumber min={0} step={1000} precision={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
            <p className="af-form-hint af-fee-hint">
              {units >= FREE_DELIVERY_MIN_UNITS
                ? `Từ ${FREE_DELIVERY_MIN_UNITS} bình/thùng: miễn phí giao trong 5 km`
                : `Dưới ${FREE_DELIVERY_MIN_UNITS} bình/thùng: phí ${SMALL_ORDER_FEE.min.toLocaleString('vi-VN')}–${SMALL_ORDER_FEE.max.toLocaleString('vi-VN')} ₫ tùy khoảng cách`}
              {floor > 0 && jugs > 0 ? `, thang bộ +${currency(stairsSurcharge(floor, jugs))}` : ''}. Gợi ý {currency(suggestedFee)}{' '}
              {fee !== suggestedFee && (
                <Button type="link" size="small" onClick={() => form.setFieldValue('deliveryFee', suggestedFee)}>
                  Áp dụng
                </Button>
              )}
            </p>
          </>
        )}
        <Form.Item name="note" label="Ghi chú" rules={[{ max: 500 }]}>
          <Input.TextArea rows={2} placeholder="Hướng dẫn tìm địa chỉ, lưu ý giao nhận..." />
        </Form.Item>
        <div className="af-order-summary">
          <span>Tổng tiền dự kiến</span>
          <strong>{currency(total + (method === 'Giao tận nơi' ? fee : 0))}</strong>
        </div>
        <Typography.Paragraph type="secondary" className="af-form-hint">
          Giá và lượng hàng được chốt khi xác nhận đơn. Khách chưa có vỏ để đổi đặt cọc riêng khi nhận hàng, không gộp vào tiền hàng.
        </Typography.Paragraph>
      </Form>
    </Modal>
  )
}
