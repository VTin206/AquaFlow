import { useEffect, useRef, useState } from 'react'
import { Alert, App, AutoComplete, Button, Col, DatePicker, Form, Input, InputNumber, Modal, Row, Segmented, Select } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { customerCode, type Customer } from '@/features/customers/types'
import { useCustomers } from '@/features/customers/useCustomers'
import { QueryError } from '@/shared/components/QueryError'
import { useFeature } from '@/shared/features'
import { useConfirmDiscard } from '@/shared/hooks/useConfirmDiscard'
import { focusNextOnEnter } from '@/shared/utils/forms'
import { currency } from '@/shared/utils/format'
import { phoneDigits } from '@/shared/utils/search'
import { useOrderList } from '../orderData'
import {
  addQuickLine,
  bestSellers,
  contactSuggestions,
  lastOrderOf,
  samePhone,
  shortProductName,
  type IntakeLine,
  type IntakeValues,
} from '../orderIntake'
import { orderedAtOf, walkInName, type Order } from '../types'
import { useIntakeAddresses, useIntakeProducts, useSubmitIntake, type IntakeAddress, type IntakeProduct } from '../useOrderIntake'
import { FormSection } from '@/shared/components/FormSection'
import { ModalTotalFooter } from '@/shared/components/ModalTotalFooter'
import { modalScrollBody, modalWidth } from '@/shared/utils/modal'

type OrderIntakeModalProps = {
  onClose: () => void
  /** Đơn vừa tạo, để trang gọi mở chi tiết. */
  onCreated?: (id: string) => void
  /** Tạo đơn từ hồ sơ khách. */
  defaultCustomer?: Customer
}

const QUICK_PRODUCTS = 4

const priceAndStock = (product: IntakeProduct) =>
  `${currency(product.price)}${product.available === undefined ? '' : ` · còn ${product.available}`}`

/** Nhận đơn bắt đầu từ số điện thoại: khách quen tự điền thông tin và đặt lại đơn trước chỉ với một lần bấm. */
export function OrderIntakeModal({ onClose, onCreated, defaultCustomer }: OrderIntakeModalProps) {
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
  const recipient = Form.useWatch('customer', form) ?? ''
  const address = Form.useWatch('address', form) ?? ''
  const area = Form.useWatch('area', form) ?? ''
  const delivery = method === 'Giao tận nơi'

  // Khách quen đã đủ tên và địa chỉ thì thu gọn thành một dòng; đổi khách tự thu gọn lại vì `editingFor` chỉ khớp khách đang sửa.
  const [editingFor, setEditingFor] = useState<string>()
  const contactCollapsed =
    Boolean(customer) && editingFor !== customer?.id && Boolean(recipient.trim()) && (!delivery || Boolean(address.trim()))

  const productOf = (id?: string) => products.find((product) => product.id === id)
  const hasJugs = lines.some((line) => productOf(line?.productId)?.unit === 'Bình')
  const goods = lines.reduce((sum, line) => sum + (productOf(line?.productId)?.price ?? 0) * (line?.quantity ?? 0), 0)
  // Giao tận nơi hoặc mua bình cần tên và số điện thoại để theo dõi vỏ; đơn quầy còn lại được phép vãng lai.
  const needsCustomer = delivery || hasJugs
  const quickProducts = bestSellers(orders)
    .map((id) => productOf(id))
    .filter((product) => product?.sellable)
    .slice(0, QUICK_PRODUCTS)

  const applyAddress = (saved: IntakeAddress) =>
    form.setFieldsValue({
      address: saved.line,
      area: saved.area ?? '',
      ...(saved.recipientName && { customer: saved.recipientName }),
      ...(saved.recipientPhone && { phone: saved.recipientPhone }),
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
    const saved = addresses.find((item) => item.isDefault)
    if (saved) applyAddress(saved)
  })

  // Số từng đặt đơn nhưng chưa có hồ sơ: điền từ đơn gần nhất vào ô còn trống, đổi số thì bỏ.
  const contactOrder = customer ? undefined : lastOrder
  const orderFilledFor = useRef<string>(undefined)
  useEffect(() => {
    const key = contactOrder && phoneDigits(contactOrder.phone)
    if (key === orderFilledFor.current) return
    const hadOrder = orderFilledFor.current !== undefined
    orderFilledFor.current = key
    if (contactOrder) {
      const { customer: name, address: line, area: place } = form.getFieldsValue(['customer', 'address', 'area'])
      form.setFieldsValue({
        customer: name || (contactOrder.customer === walkInName ? '' : contactOrder.customer),
        address: line || contactOrder.address,
        area: place || (contactOrder.area ?? ''),
      })
    } else if (hadOrder && !customer) form.setFieldsValue({ customer: '', address: '', area: '' })
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
      lines: kept.length ? kept.map(({ productId, quantity }) => ({ productId, quantity })) : [{ quantity: 1 }],
    })
    if (dropped.length) message.warning(`Không còn bán được: ${dropped.map((line) => line.name).join(', ')}. Chọn sản phẩm thay thế.`)
    else message.success(`Đã điền theo đơn ${order.code ?? order.id}. Kiểm tra lại rồi tạo đơn.`)
  }

  const typed = typedPhone.trim()
  const suggestions = !customer && typed.length >= 2 ? contactSuggestions(customers, orders, typed) : []
  const isNewPhone = !customer && !lastOrder && phoneDigits(typed).length >= 10
  const customerFacts = customer
    ? [
        customerCode(customer),
        `${customer.orders} đơn`,
        ...(showBottles ? [`đang giữ ${customer.bottlesHeld} vỏ`] : []),
        ...(showDebt && customer.debt > 0 ? [`còn nợ ${currency(customer.debt)}`] : []),
      ].join(' · ')
    : ''

  return (
    <Modal
      open
      title="Tiếp nhận đơn hàng"
      width={modalWidth.large}
      styles={modalScrollBody}
      okText="Tạo đơn chờ xác nhận"
      cancelText="Hủy"
      okButtonProps={{ disabled: loadingProducts || Boolean(productsError) }}
      confirmLoading={submit.isPending}
      onOk={() => form.submit()}
      onCancel={submit.isPending ? undefined : cancel}
      mask={{ closable: !submit.isPending }}
      footer={(_, { OkBtn, CancelBtn }) => (
        <ModalTotalFooter label="Tiền hàng dự kiến" value={currency(goods)}>
          <CancelBtn />
          <OkBtn />
        </ModalTotalFooter>
      )}
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
            lines: [{ quantity: 1 }],
          }}
          // Lỗi nằm ở phần đang thu gọn thì mở ra để nhân viên thấy.
          onFinishFailed={() => setEditingFor(customer?.id)}
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
          <div className="af-form-columns">
            <div>
              <FormSection title="Khách hàng">
                <Form.Item
                  name="phone"
                  label="Số điện thoại"
                  validateTrigger="onBlur"
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
                      // Đang gõ dở thì chưa báo lỗi; rời ô hoặc tạo đơn mới kiểm tra.
                      form.setFields([{ name: 'phone', errors: [] }])
                    }}
                  />
                </Form.Item>
                {isNewPhone && <p className="af-form-hint af-known-customer">Khách mới: nhập tên và địa chỉ bên dưới.</p>}
                {contactCollapsed ? (
                  <div className="af-intake-contact">
                    <div className="af-cell-stack">
                      <strong>{recipient}</strong>
                      <small>{customerFacts}</small>
                      {delivery && (
                        <span>
                          {address}
                          {area ? ` · ${area}` : ''}
                        </span>
                      )}
                    </div>
                    <Button size="small" icon={<Pencil size={14} />} onClick={() => setEditingFor(customer?.id)}>
                      Sửa
                    </Button>
                  </div>
                ) : (
                  customer && <p className="af-form-hint af-known-customer">{customerFacts}</p>
                )}
                <Form.Item
                  name="customer"
                  label="Tên người nhận"
                  hidden={contactCollapsed}
                  rules={[
                    { required: needsCustomer, whitespace: true, message: 'Nhập tên người nhận.' },
                    { max: 150, message: 'Tối đa 150 ký tự.' },
                  ]}
                >
                  <Input placeholder={needsCustomer ? 'Tên khách đặt nước' : 'Để trống nếu là khách vãng lai'} />
                </Form.Item>
                {lastOrder && (
                  <div className="af-intake-last">
                    <div className="af-cell-stack">
                      <small>Đơn gần nhất · {orderedAtOf(lastOrder).label}</small>
                      <span>{lastOrder.items}</span>
                      <small>{currency(lastOrder.total)}</small>
                    </div>
                    <Button
                      color="primary"
                      variant="outlined"
                      icon={<RotateCcw size={15} />}
                      disabled={loadingProducts}
                      onClick={() => reorder(lastOrder)}
                    >
                      Đặt lại đơn này
                    </Button>
                  </div>
                )}
              </FormSection>

              <FormSection title="Giao nhận">
                <Row gutter={12}>
                  <Col xs={24} sm={14}>
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
                  <Col xs={24} sm={10}>
                    <Form.Item name="channel" label="Kênh tiếp nhận" rules={[{ required: true }]}>
                      <Select options={['Điện thoại', 'Tại quầy', 'Tin nhắn'].map((value) => ({ value, label: value }))} />
                    </Form.Item>
                  </Col>
                </Row>
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
                      hidden={contactCollapsed}
                      rules={[
                        { required: true, whitespace: true, message: 'Nhập địa chỉ giao hàng.' },
                        { max: 255, message: 'Tối đa 255 ký tự.' },
                      ]}
                    >
                      <AutoComplete
                        options={addresses?.map((saved) => ({ value: saved.line }))}
                        placeholder="Số nhà, tên đường, phường/xã, tỉnh/thành phố"
                        onSelect={(value: string) => {
                          const saved = addresses?.find((item) => item.line === value)
                          if (saved) applyAddress(saved)
                        }}
                      />
                    </Form.Item>
                    <Form.Item name="area" label="Khu vực" hidden={contactCollapsed} rules={[{ max: 150, message: 'Tối đa 150 ký tự.' }]}>
                      <Input placeholder="Phường / quận" />
                    </Form.Item>
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
                  </>
                )}
              </FormSection>
            </div>

            <div>
              <FormSection title="Sản phẩm">
                {quickProducts.length > 0 && (
                  <div className="af-quick-products" role="group" aria-label="Chọn nhanh sản phẩm bán chạy">
                    <small>Bán chạy</small>
                    {quickProducts.map((product) => (
                      <Button
                        key={product!.id}
                        size="small"
                        icon={<Plus size={14} />}
                        title={product!.name}
                        aria-label={`Thêm ${product!.name}`}
                        onClick={() => form.setFieldValue('lines', addQuickLine(form.getFieldValue('lines') ?? [], product!.id))}
                      >
                        {shortProductName(product!.name)}
                      </Button>
                    ))}
                  </div>
                )}
                <Form.List name="lines">
                  {(fields, { add, remove }) => (
                    <>
                      {fields.map((field, index) => {
                        const chosen = productOf(lines[field.name]?.productId)
                        return (
                          <div className="af-order-line-form" key={field.key}>
                            <Form.Item
                              name={[field.name, 'productId']}
                              label={`Sản phẩm ${index + 1}`}
                              extra={chosen && priceAndStock(chosen)}
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
                                // Ô hẹp nên chỉ hiện tên; mã, giá, tồn nằm ở danh sách chọn và dòng dưới ô.
                                labelRender={({ value, label }) => productOf(String(value))?.name ?? label}
                                optionRender={({ value }) => {
                                  const product = productOf(String(value))
                                  return (
                                    product && (
                                      <div className="af-intake-option">
                                        <span>{product.name}</span>
                                        <small>
                                          {product.sku} · {priceAndStock(product)}
                                        </small>
                                      </div>
                                    )
                                  )
                                }}
                                options={products.map((product) => ({
                                  value: product.id,
                                  label: `${product.sku} ${product.name}`,
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
                        )
                      })}
                      <Button type="dashed" block icon={<Plus size={16} />} onClick={() => add({ quantity: 1 })}>
                        Thêm sản phẩm
                      </Button>
                    </>
                  )}
                </Form.List>
              </FormSection>

              <FormSection title="Ghi chú">
                <Form.Item name="note" rules={[{ max: 500, message: 'Tối đa 500 ký tự.' }]}>
                  <Input.TextArea aria-label="Ghi chú" rows={3} placeholder="Hướng dẫn tìm địa chỉ, lưu ý giao nhận..." />
                </Form.Item>
                <p className="af-form-hint">
                  Đơn mới ở trạng thái chờ xác nhận. Tồn kho được kiểm tra và giữ hàng khi xác nhận đơn. Phí giao và tổng tiền cuối cùng do
                  hệ thống tính.
                  {showBottles && ' Khách chưa có vỏ để đổi đặt cọc riêng khi nhận hàng, không gộp vào tiền hàng.'}
                </p>
              </FormSection>
            </div>
          </div>
        </Form>
      )}
    </Modal>
  )
}
