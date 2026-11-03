import { useEffect, useRef, useState } from 'react'
import { Alert, App, AutoComplete, Button, Col, DatePicker, Form, Input, InputNumber, Modal, Row, Segmented, Select } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { Plus, RotateCcw, Trash2 } from 'lucide-react'
import { customerCode, type Customer } from '@/features/customers/types'
import { useCustomers } from '@/features/customers/useCustomers'
import { QueryError } from '@/shared/components/QueryError'
import { useFeature, useIsDemo } from '@/shared/features'
import { useConfirmDiscard } from '@/shared/hooks/useConfirmDiscard'
import { FREE_DELIVERY_MIN_UNITS, SMALL_ORDER_FEE, stairsSurcharge, suggestedDeliveryFee } from '@/shared/policy'
import { focusNextOnEnter } from '@/shared/utils/forms'
import { currency } from '@/shared/utils/format'
import { matchesSearch, phoneDigits } from '@/shared/utils/search'
import { useOrderList } from '../orderData'
import { addQuickLine, bestSellers, lastOrderOf, samePhone, type IntakeLine, type IntakeValues } from '../orderIntake'
import { orderedAtOf, type Order } from '../types'
import { useIntakeAddresses, useIntakeProducts, useSubmitIntake, type IntakeAddress } from '../useOrderIntake'

type OrderIntakeModalProps = {
  onClose: () => void
  /** Đơn vừa tạo, để trang gọi mở chi tiết. */
  onCreated?: (id: string) => void
  /** Tạo đơn từ hồ sơ khách. */
  defaultCustomer?: Customer
}

const QUICK_PRODUCTS = 4

/** Nhận đơn bắt đầu từ số điện thoại: khách quen tự điền thông tin và đặt lại đơn trước chỉ với một lần bấm. */
export function OrderIntakeModal({ onClose, onCreated, defaultCustomer }: OrderIntakeModalProps) {
  const demo = useIsDemo()
  const { message } = App.useApp()
  const [form] = Form.useForm<IntakeValues>()
  const cancel = useConfirmDiscard(form, onClose)
  const showBottles = useFeature('bottleLedger')
  const showDebt = useFeature('customerDebt')
  const { products, isPending: loadingProducts, error: productsError, refetch: refetchProducts } = useIntakeProducts()
  const customersQuery = useCustomers()
  const { data: orders = [] } = useOrderList()
  const submit = useSubmitIntake()

  const customers = customersQuery.data ?? []
  // Khách theo số đang gõ; mở từ hồ sơ thì giữ đúng khách đó cho đến khi nhân viên đổi số.
  const [typedPhone, setTypedPhone] = useState(defaultCustomer?.phone ?? '')
  const [pinned, setPinned] = useState(defaultCustomer)
  const customer = pinned
    ? (customers.find((item) => item.id === pinned.id) ?? pinned)
    : customers.find((item) => samePhone(item.phone, typedPhone))
  const { addresses, isError: addressesFailed, refetch: refetchAddresses } = useIntakeAddresses(customer)
  const lastOrder = lastOrderOf(orders, customer?.id, typedPhone)

  const method = Form.useWatch('method', form) ?? 'Giao tận nơi'
  const lines: IntakeLine[] = Form.useWatch('lines', form) ?? []
  const fee = Form.useWatch('deliveryFee', form) ?? 0
  const floor = Form.useWatch('floor', form) ?? 0
  const delivery = method === 'Giao tận nơi'

  const productOf = (id?: string) => products.find((product) => product.id === id)
  const units = lines.reduce((sum, line) => sum + (line?.quantity ?? 0), 0)
  const jugs = lines.reduce((sum, line) => sum + (productOf(line?.productId)?.unit === 'Bình' ? (line?.quantity ?? 0) : 0), 0)
  const goods = lines.reduce((sum, line) => sum + (productOf(line?.productId)?.price ?? 0) * (line?.quantity ?? 0), 0)
  const suggestedFee = suggestedDeliveryFee({ units, jugs, floor })
  // Bản dùng thử giữ quy tắc mua bình cần hồ sơ để theo dõi vỏ; backend chỉ bắt buộc với đơn giao.
  const needsCustomer = delivery || (demo && jugs > 0)
  const quickProducts = bestSellers(orders)
    .map((id) => productOf(id))
    .filter((product) => product?.sellable)
    .slice(0, QUICK_PRODUCTS)

  const applyAddress = (address: IntakeAddress) =>
    form.setFieldsValue({
      address: address.line,
      area: address.area ?? '',
      ...(address.recipientName && { customer: address.recipientName }),
      ...(address.recipientPhone && { phone: address.recipientPhone }),
    })

  // Tên và số không còn bắt buộc (chuyển sang tại quầy) thì bỏ lỗi đang hiện; số sai vẫn bị kiểm tra lại khi tạo đơn.
  useEffect(() => {
    if (!needsCustomer)
      form.setFields([
        { name: 'customer', errors: [] },
        { name: 'phone', errors: [] },
      ])
  }, [needsCustomer, form])

  // Đổi khách thì thay tên và bỏ địa chỉ của khách trước.
  const filledFor = useRef(defaultCustomer?.id)
  const addressFilledFor = useRef<string>(undefined)
  useEffect(() => {
    if (customer?.id === filledFor.current) return
    const hadCustomer = filledFor.current !== undefined
    filledFor.current = customer?.id
    addressFilledFor.current = undefined
    if (customer || hadCustomer) form.setFieldsValue({ customer: customer?.name ?? '', address: '', area: '' })
  })
  // Tự điền địa chỉ mặc định, mỗi khách một lần để không đè phần nhân viên đã sửa.
  useEffect(() => {
    if (!delivery || !customer || !addresses || addressFilledFor.current === customer.id) return
    addressFilledFor.current = customer.id
    const address = addresses.find((item) => item.isDefault)
    if (address) applyAddress(address)
  })

  const reorder = (order: Order) => {
    const kept = order.lines.filter((line) => productOf(line.productId)?.sellable)
    const dropped = order.lines.filter((line) => !productOf(line.productId)?.sellable)
    addressFilledFor.current = customer?.id
    form.setFieldsValue({
      method: order.method,
      customer: order.customer,
      address: order.method === 'Giao tận nơi' ? order.address : '',
      area: order.area ?? '',
      floor: order.floor ?? 0,
      deliveryFee: order.deliveryFee,
      lines: kept.length ? kept.map(({ productId, quantity }) => ({ productId, quantity })) : [{ quantity: 1 }],
    })
    if (dropped.length) message.warning(`Không còn bán được: ${dropped.map((line) => line.name).join(', ')}. Chọn sản phẩm thay thế.`)
    else message.success(`Đã điền theo đơn ${order.code ?? order.id}. Kiểm tra lại rồi tạo đơn.`)
  }

  const typed = typedPhone.trim()
  const suggestions =
    !customer && typed.length >= 2
      ? customers
          .filter((item) => item.phone && matchesSearch(typed, `${item.name} ${item.phone}`, item.phone))
          .slice(0, 6)
          .map((item) => ({ value: item.phone, label: `${item.name} · ${item.phone}` }))
      : []
  const isNewPhone = !customer && !lastOrder && phoneDigits(typed).length >= 10
  const customerFacts = customer && [
    customerCode(customer),
    `${customer.orders} đơn`,
    ...(showBottles ? [`đang giữ ${customer.bottlesHeld} vỏ`] : []),
    ...(showDebt && customer.debt > 0 ? [`còn nợ ${currency(customer.debt)}`] : []),
  ]

  return (
    <Modal
      open
      title="Tiếp nhận đơn hàng"
      width={740}
      styles={{ body: { maxHeight: 'calc(100dvh - 200px)', overflowY: 'auto', paddingRight: 8 } }}
      okText="Tạo đơn chờ xác nhận"
      cancelText="Hủy"
      okButtonProps={{ disabled: loadingProducts || Boolean(productsError) }}
      confirmLoading={submit.isPending}
      onOk={() => form.submit()}
      onCancel={submit.isPending ? undefined : cancel}
      mask={{ closable: !submit.isPending }}
    >
      {productsError ? (
        <QueryError error={productsError} onRetry={refetchProducts} />
      ) : (
        <Form<IntakeValues>
          name="order-intake"
          form={form}
          layout="vertical"
          disabled={submit.isPending}
          scrollToFirstError={{ block: 'center', focus: true }}
          onKeyDown={focusNextOnEnter}
          initialValues={{
            phone: defaultCustomer?.phone,
            customer: defaultCustomer?.name,
            method: 'Giao tận nơi',
            channel: 'Điện thoại',
            deliveryFee: 0,
            floor: 0,
            lines: [{ quantity: 1 }],
          }}
          onFinish={(values) =>
            submit.mutate(
              { values, customerId: customer?.id },
              {
                onSuccess: ({ id, code }) => {
                  message.success(`Đã tạo đơn ${code}. Đơn đang chờ xác nhận.`)
                  onClose()
                  onCreated?.(id)
                },
                onError: (error) => message.error(error.message),
              },
            )
          }
        >
          {customersQuery.isError && (
            <Alert
              type="warning"
              style={{ marginBottom: 16 }}
              title="Không tải được hồ sơ khách hàng. Bạn vẫn có thể điền thông tin bên dưới."
              action={<Button onClick={() => void customersQuery.refetch()}>Thử lại</Button>}
            />
          )}
          <Form.Item
            name="phone"
            label="Số điện thoại khách"
            rules={[
              { required: needsCustomer, message: 'Nhập số điện thoại.' },
              {
                pattern: /^(0|\+84)[0-9]{9,10}$/,
                transform: (value?: string) => value?.replace(/[\s().-]/g, ''),
                message: 'Số điện thoại không hợp lệ.',
              },
            ]}
          >
            <AutoComplete
              autoFocus
              options={suggestions}
              placeholder="Nhập số điện thoại hoặc tên để tìm khách quen"
              onChange={(value: string) => {
                setTypedPhone(value ?? '')
                setPinned(undefined)
              }}
            />
          </Form.Item>
          {customer && (
            <p className="af-form-hint af-known-customer">
              <strong>{customer.name}</strong> · {customerFacts?.join(' · ')}
            </p>
          )}
          {isNewPhone && <p className="af-form-hint af-known-customer">Khách mới: nhập tên và địa chỉ bên dưới.</p>}
          {lastOrder && (
            <div className="af-intake-last">
              <div className="af-cell-stack">
                <small>Đơn gần nhất · {orderedAtOf(lastOrder).label}</small>
                <span>{lastOrder.items}</span>
                <small>{currency(lastOrder.total)}</small>
              </div>
              <Button type="primary" icon={<RotateCcw size={15} />} disabled={loadingProducts} onClick={() => reorder(lastOrder)}>
                Đặt lại đơn này
              </Button>
            </div>
          )}

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="method" label="Hình thức nhận" rules={[{ required: true }]}>
                <Segmented
                  block
                  options={[
                    { value: 'Giao tận nơi', label: 'Giao tận nơi' },
                    { value: 'Tại quầy', label: 'Tại quầy' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="channel" label="Kênh tiếp nhận" rules={[{ required: true }]}>
                <Select options={['Điện thoại', 'Tại quầy', 'Tin nhắn'].map((value) => ({ value, label: value }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="customer"
            label="Tên người nhận"
            rules={[
              { required: needsCustomer, whitespace: true, message: 'Nhập tên người nhận.' },
              { max: 150, message: 'Tối đa 150 ký tự.' },
            ]}
          >
            <Input placeholder={needsCustomer ? 'Tên khách đặt nước' : 'Để trống nếu là khách vãng lai'} />
          </Form.Item>
          {delivery && (
            <>
              {addressesFailed && (
                <Alert
                  type="warning"
                  style={{ marginBottom: 16 }}
                  title="Không tải được địa chỉ đã lưu."
                  action={<Button onClick={() => void refetchAddresses()}>Thử lại</Button>}
                />
              )}
              <Form.Item
                name="address"
                label="Địa chỉ giao hàng"
                rules={[
                  { required: true, whitespace: true, message: 'Nhập địa chỉ giao hàng.' },
                  { max: 255, message: 'Tối đa 255 ký tự.' },
                ]}
              >
                <AutoComplete
                  options={addresses?.map((address) => ({ value: address.line }))}
                  placeholder="Số nhà, tên đường, phường/xã, tỉnh/thành phố"
                  onSelect={(value: string) => {
                    const address = addresses?.find((item) => item.line === value)
                    if (address) applyAddress(address)
                  }}
                />
              </Form.Item>
              <Row gutter={16}>
                {!demo && (
                  <Col xs={24} sm={12}>
                    <Form.Item name="area" label="Khu vực" rules={[{ max: 150, message: 'Tối đa 150 ký tự.' }]}>
                      <Input placeholder="Phường / quận" />
                    </Form.Item>
                  </Col>
                )}
                <Col xs={24} sm={demo ? 24 : 12}>
                  <Form.Item
                    name="appointment"
                    label="Giờ nhận mong muốn"
                    rules={[
                      {
                        validator: (_, value?: Dayjs) =>
                          !value || value.isAfter(dayjs()) ? Promise.resolve() : Promise.reject(new Error('Chọn giờ trong tương lai.')),
                      },
                    ]}
                  >
                    <DatePicker
                      showTime
                      format="DD/MM/YYYY HH:mm"
                      disabledDate={(date) => date.isBefore(dayjs(), 'day')}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

          <div className="af-form-section-title">Sản phẩm</div>
          {quickProducts.length > 0 && (
            <div className="af-quick-products" role="group" aria-label="Chọn nhanh sản phẩm bán chạy">
              {quickProducts.map((product) => (
                <Button
                  key={product!.id}
                  size="small"
                  icon={<Plus size={14} />}
                  onClick={() => form.setFieldValue('lines', addQuickLine(form.getFieldValue('lines') ?? [], product!.id))}
                >
                  {product!.name}
                </Button>
              ))}
            </div>
          )}
          <Form.List name="lines">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field, index) => (
                  <div className="af-order-line-form" key={field.key}>
                    <Form.Item
                      name={[field.name, 'productId']}
                      label={`Sản phẩm ${index + 1}`}
                      rules={[
                        { required: true, message: 'Chọn sản phẩm.' },
                        {
                          validator: (_, value) =>
                            value === undefined ||
                            lines.filter((line, other) => other !== field.name && line?.productId === value).length === 0
                              ? Promise.resolve()
                              : Promise.reject(new Error('Sản phẩm đã có ở dòng khác; tăng số lượng thay vì thêm dòng.')),
                        },
                      ]}
                    >
                      <Select
                        loading={loadingProducts}
                        showSearch={{ optionFilterProp: 'label' }}
                        placeholder="Chọn sản phẩm"
                        options={products.map((product) => ({
                          value: product.id,
                          label: `${product.sku} · ${product.name} · ${currency(product.price)}${product.available === undefined ? '' : ` · còn ${product.available}`}`,
                          disabled: !product.sellable,
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
                <Button type="dashed" block icon={<Plus size={16} />} onClick={() => add({ quantity: 1 })}>
                  Thêm sản phẩm
                </Button>
              </>
            )}
          </Form.List>

          <div className="af-form-section-title">Tổng tiền và ghi chú</div>
          {/* Tài khoản thật: phí giao do hệ thống tính nên không nhập ở đây. */}
          {demo && delivery && (
            <>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item name="floor" label="Giao lên lầu (thang bộ)">
                    <Select
                      options={[
                        { value: 0, label: 'Tầng trệt / có thang máy' },
                        ...[1, 2, 3, 4].map((value) => ({
                          value,
                          label: `Lầu ${value} · +${stairsSurcharge(value, 1).toLocaleString('vi-VN')} ₫/bình`,
                        })),
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
          <Form.Item name="note" label="Ghi chú" rules={[{ max: 500, message: 'Tối đa 500 ký tự.' }]}>
            <Input.TextArea rows={2} placeholder="Hướng dẫn tìm địa chỉ, lưu ý giao nhận..." />
          </Form.Item>
          <div className="af-order-summary">
            <span>{demo ? 'Tổng tiền dự kiến' : 'Tiền hàng dự kiến'}</span>
            <strong>{currency(goods + (demo && delivery ? fee : 0))}</strong>
          </div>
          <p className="af-form-hint">
            Đơn mới ở trạng thái chờ xác nhận. Tồn kho được kiểm tra và giữ hàng khi xác nhận đơn.
            {demo
              ? ' Khách chưa có vỏ để đổi đặt cọc riêng khi nhận hàng, không gộp vào tiền hàng.'
              : ' Tổng tiền cuối cùng do hệ thống tính.'}
          </p>
        </Form>
      )}
    </Modal>
  )
}
