import { Alert, App, Button, Card, Checkbox, DatePicker, Empty, Form, Input, InputNumber, Radio, Result, Skeleton, Typography } from 'antd'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { deliveryQuoteApi } from './deliveryQuoteApi'
import { DeliveryFeeSummary } from './components/DeliveryFeeSummary'
import dayjs, { type Dayjs } from 'dayjs'
import { ChevronDown, Wallet } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router'
import type { LiveOrder } from '@/features/live/orderApi'
import { Money } from '@/shared/components/Money'
import { QueryError } from '@/shared/components/QueryError'
import { focusNextOnEnter } from '@/shared/utils/forms'
import { readProfile, saveProfile, useCart, useCartActions } from './cart'
import { submitCheckoutOnce } from './checkoutSubmit'
import { CheckoutReview } from './components/CheckoutReview'
import { CheckoutDeposit } from './components/CheckoutDeposit'
import { DELIVERY_SLOTS, slotStarted, slotText, slotWindow, type DeliverySlotKey } from '@/shared/utils/deliveryWindow'
import { usePlaceWebOrder, useShopProducts, useTransferAccount } from './shopService'
import {
  CUSTOMER_NOTE_MAX,
  DELIVERY_PLACES,
  SHELL_CHOICES,
  PAYMENT_CHOICES,
  checkoutNote,
  stairFloors,
  type DeliveryPlace,
  type PaymentChoice,
  type ShellChoice,
} from './checkoutChoices'
import { useAuth } from '@/features/auth/useAuth'
import { isCustomer } from '@/features/auth/accountAccess'
import { accountKey, customerAccountApi, type SavedAddress } from './customerAccountApi'
import { SavedAddressPicker } from './SavedAddressPicker'
import { WardSelect } from '@/shared/address/WardSelect'
import { TextArea } from '@/shared/components/TextArea'

type CheckoutForm = {
  customer: string
  phone: string
  address: string
  area: string
  when: 'asap' | 'scheduled'
  deliveryDate?: Dayjs
  slot?: DeliverySlotKey
  note?: string
  remember: boolean
  saveAddress?: boolean
  place: DeliveryPlace
  floor: number
  payment: PaymentChoice
  shells: ShellChoice
}

const nextStepHint = 'Còn hàng thì đơn được xác nhận ngay, cửa hàng chuẩn bị rồi giao cho bạn.'

/** Đặt đơn là việc không rút lại được: Enter ở ô chọn không được tự gửi form như mặc định của trình duyệt. */
function handleFormKeys(event: KeyboardEvent<HTMLElement>) {
  const target = event.target
  if (event.key === 'Enter' && target instanceof HTMLInputElement && (target.type === 'radio' || target.type === 'checkbox')) {
    event.preventDefault()
    return
  }
  focusNextOnEnter(event)
}

export function CheckoutPage() {
  const { user } = useAuth()
  const cart = useCart()
  const actions = useCartActions()
  const products = useShopProducts()
  const mutation = usePlaceWebOrder()
  const { message } = App.useApp()
  const navigate = useNavigate()
  const { openCart } = useOutletContext<{ openCart: () => void }>()
  const [form] = Form.useForm<CheckoutForm>()
  const place: DeliveryPlace = Form.useWatch('place', form) ?? 'room'
  // Giao ở cổng/sảnh thì không đi thang bộ: báo phí và gửi đơn với 0 tầng.
  const floor = stairFloors(place, Form.useWatch('floor', form) ?? 0)
  const payment: PaymentChoice = Form.useWatch('payment', form) ?? 'cod'
  const shells: ShellChoice = Form.useWatch('shells', form) ?? 'exchange'
  // Cửa hàng chưa nhập số tài khoản thì chưa nhận chuyển khoản; vẫn hiện lựa chọn nhưng khóa và ghi "chưa hỗ trợ".
  const canTransfer = Boolean(useTransferAccount())
  const [submitError, setSubmitError] = useState<string>()
  const [placedLiveOrder, setPlacedLiveOrder] = useState<LiveOrder>()
  const submitLock = useRef(false)
  useEffect(() => {
    document.title = 'Đặt hàng | AquaFlow'
  }, [])
  const profile = readProfile()
  // Thông tin đã lưu trên máy được ưu tiên vì khách có thể đặt hộ người khác; chưa lưu thì lấy từ tài khoản.
  // Tài khoản không có họ tên thì `name` là email, không dùng làm tên người nhận.
  const accountDefaults =
    user && isCustomer(user) ? { customer: user.name === user.email ? undefined : user.name, phone: user.phone ?? undefined } : undefined
  const customer = isCustomer(user)
  const queryClient = useQueryClient()
  const addressKey = [...accountKey(user?.email), 'addresses']
  const savedAddresses = useQuery({ queryKey: addressKey, queryFn: customerAccountApi.addresses, enabled: customer })
  const applyAddress = (address: SavedAddress) =>
    form.setFieldsValue({
      customer: address.recipientName,
      phone: address.recipientPhone,
      address: address.addressLine,
      area: address.area,
    })
  // Khách có sổ địa chỉ: điền sẵn địa chỉ mặc định một lần, trừ khi máy đã lưu thông tin hoặc khách đã tự nhập.
  const hasProfile = Boolean(profile)
  const prefilled = useRef(false)
  useEffect(() => {
    if (prefilled.current || !savedAddresses.data) return
    prefilled.current = true
    const address = savedAddresses.data.find((item) => item.isDefault) ?? savedAddresses.data[0]
    if (address && !hasProfile && !form.isFieldsTouched(['address', 'area'])) applyAddress(address)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi sổ địa chỉ tải xong
  }, [savedAddresses.data])
  const typedAddress: string = Form.useWatch('address', form) ?? ''
  const typedArea: string = Form.useWatch('area', form) ?? ''
  const inAddressBook = (address: string, area: string) =>
    (savedAddresses.data ?? []).some((item) => item.addressLine.trim() === address.trim() && item.area.trim() === area.trim())
  // Chỉ mời lưu khi địa chỉ đang nhập chưa có trong sổ.
  const canSaveAddress =
    customer && savedAddresses.isSuccess && Boolean(typedAddress.trim() && typedArea.trim()) && !inAddressBook(typedAddress, typedArea)
  const lines = cart.map((line) => ({ ...line, product: products.data?.find((item) => item.id === line.productId) }))
  // Mã sản phẩm lạ (giỏ cũ, đổi nguồn dữ liệu) không có trong danh mục nên bị chặn ở `invalid` bên dưới.
  const invalidCartLine = cart.some((line) => !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 99)
  const invalid = invalidCartLine || lines.some((line) => !line.product || line.product.available === false)
  const subtotal = lines.reduce((sum, line) => sum + (line.product?.price ?? 0) * line.quantity, 0)
  const units = lines.reduce((sum, line) => sum + line.quantity, 0)

  const validFloor = Number.isInteger(floor) && floor >= 0 && floor <= 30
  const quote = useQuery({
    queryKey: ['shop', 'delivery-quote', cart, floor],
    queryFn: () =>
      deliveryQuoteApi.quote(
        cart.map((line) => ({ productId: Number(line.productId), quantity: line.quantity })),
        floor,
      ),
    enabled: !invalid && cart.length > 0 && validFloor,
    retry: false,
    staleTime: 0,
    // Giữ báo giá trước khi đổi số tầng/giỏ để dòng cách tính không biến mất; số tiền vẫn ẩn tới khi tính xong (quoteBlocked).
    placeholderData: (previous) => previous,
  })
  const quoteBlocked = !validFloor || !quote.data || quote.isPlaceholderData || quote.isError || quote.isFetching
  const fee = quoteBlocked ? null : quote.data!.deliveryFee
  const quotedSubtotal = quoteBlocked ? subtotal : quote.data!.subtotal
  const total = quotedSubtotal + (fee ?? 0)

  // Chỉ hỏi vỏ bình khi giỏ có sản phẩm đổi vỏ (bình có loại vỏ).
  const hasShells = lines.some((line) => line.product?.bottleTypeId != null)
  const depositHint = <CheckoutDeposit lines={lines} choice={hasShells ? shells : undefined} />
  const submit = (values: CheckoutForm) => {
    if (submitLock.current || mutation.isPending || invalid || quoteBlocked || !cart.length || products.isError || products.isPending)
      return
    setSubmitError(undefined)
    // Ngày và khung đã chọn trước đó vẫn có thể còn trong form, nên chỉ gửi khi khách đang chọn "Chọn khung giờ".
    const chosen =
      values.when === 'scheduled' && values.deliveryDate && values.slot ? slotWindow(values.deliveryDate, values.slot) : undefined
    const draft = {
      customer: values.customer.trim(),
      phone: values.phone.replace(/[\s().-]/g, ''),
      address: values.address.trim(),
      area: values.area.trim(),
      appointment: chosen?.from.toISOString(),
      appointmentUntil: chosen?.until.toISOString(),
      note: checkoutNote(values.place, canTransfer ? values.payment : 'cod', values.note, hasShells ? values.shells : undefined),
      lines: cart,
      floor: stairFloors(values.place, values.floor ?? 0),
      expectedTotal: quote.data!.total,
    }
    void submitCheckoutOnce(
      submitLock,
      () => mutation.mutateAsync(draft),
      (order) => {
        saveProfile(
          values.remember
            ? {
                customer: values.customer.trim(),
                phone: values.phone.trim(),
                address: values.address.trim(),
                area: values.area.trim(),
              }
            : null,
        )
        if (customer && values.saveAddress && savedAddresses.data && !inAddressBook(draft.address, draft.area))
          void customerAccountApi
            .createAddress({
              recipientName: draft.customer,
              recipientPhone: draft.phone,
              addressLine: draft.address,
              area: draft.area,
              isDefault: !savedAddresses.data.length,
            })
            .then(() => queryClient.invalidateQueries({ queryKey: accountKey(user?.email) }))
            .catch(() => message.warning('Đơn đã đặt, nhưng chưa lưu được địa chỉ vào sổ địa chỉ.'))
        actions.clear()
        // Có mã tra cứu thì sang trang theo dõi đơn, chưa có thì báo thành công tại đây.
        // Khách có tài khoản sang thẳng đơn của mình; khách vãng lai có mã tra cứu thì sang trang theo dõi đơn.
        if (customer && 'id' in order && Number.isSafeInteger(order.id)) navigate(`/shop/orders/${order.id}`, { state: { placed: true } })
        else if ('trackingToken' in order && order.trackingToken) navigate(`/track/${order.trackingToken}`, { state: { placed: true } })
        else {
          setPlacedLiveOrder(order as LiveOrder)
          window.scrollTo({ top: 0 })
        }
      },
      (error) => {
        void quote.refetch()
        setSubmitError(error.message)
        message.error(error.message)
      },
    )
  }

  if (placedLiveOrder)
    return (
      <div className="af-shop-page af-shop-narrow">
        <Result
          status="success"
          title="Đặt hàng thành công"
          subTitle={
            placedLiveOrder.orderCode ? (
              <>
                Mã đơn:{' '}
                <Typography.Text strong copyable={{ tooltips: ['Sao chép mã đơn', 'Đã sao chép'] }}>
                  {placedLiveOrder.orderCode}
                </Typography.Text>
                {!isCustomer(user) && <p className="af-checkout-placed-hint">Lưu lại mã này để hỏi cửa hàng về đơn của bạn.</p>}
              </>
            ) : (
              'Đơn hàng đã được ghi nhận.'
            )
          }
          extra={[
            ...(isCustomer(user)
              ? [
                  <Link key="order" to={`/shop/orders/${placedLiveOrder.id}`}>
                    <Button>Xem đơn hàng</Button>
                  </Link>,
                ]
              : []),
            <Button
              key="continue"
              type="primary"
              onClick={() => {
                setPlacedLiveOrder(undefined)
                navigate('/shop')
              }}
            >
              Tiếp tục mua sắm
            </Button>,
          ]}
        />
      </div>
    )

  return (
    <div className="af-shop-page af-checkout-page">
      <div className="af-checkout-head">
        <Typography.Title level={2}>Đặt hàng</Typography.Title>
        {!user && (
          <span>
            Đã có tài khoản?{' '}
            <Link to="/shop/account" state={{ from: '/checkout' }}>
              Đăng nhập
            </Link>
          </span>
        )}
      </div>
      {products.isPending ? (
        <Skeleton active />
      ) : products.isError ? (
        <QueryError error={products.error} onRetry={products.refetch} />
      ) : !cart.length ? (
        <Empty description="Giỏ hàng đang trống.">
          <Link to="/shop/drinks">Chọn sản phẩm</Link>
        </Empty>
      ) : (
        <>
          {invalid && (
            <Alert
              style={{ marginTop: 12 }}
              type="warning"
              showIcon
              title="Có sản phẩm không còn đặt được"
              action={<Button onClick={openCart}>Sửa giỏ hàng</Button>}
            />
          )}
          {submitError && <Alert style={{ marginTop: 12 }} type="error" showIcon title="Không thể tạo đơn" description={submitError} />}
          <details className="af-checkout-fold">
            <summary>
              <ChevronDown size={18} aria-hidden />
              <span>{units} sản phẩm</span>
              <Money value={total} tone="due" />
            </summary>
            <CheckoutReview lines={lines} subtotal={quotedSubtotal} fee={fee} depositHint={depositHint} />
            <Button block onClick={openCart}>
              Sửa giỏ hàng
            </Button>
          </details>
          <Form
            className="af-checkout-layout"
            form={form}
            name="checkout"
            layout="vertical"
            scrollToFirstError={{ focus: true, block: 'center' }}
            initialValues={{
              ...accountDefaults,
              ...profile,
              when: 'asap',
              place: 'room',
              floor: 0,
              payment: 'cod',
              shells: 'exchange',
              remember: Boolean(profile),
              saveAddress: true,
            }}
            onFinish={submit}
            onKeyDown={handleFormKeys}
          >
            <div className="af-checkout-main">
              {/* Người nhận và nơi giao chung một khung để khách điền liền một mạch. */}
              <Card title="Giao đến">
                {customer && <SavedAddressPicker onSelect={applyAddress} current={{ address: typedAddress, area: typedArea }} />}
                <div className="af-checkout-who">
                  <Form.Item
                    name="customer"
                    label="Tên người nhận"
                    rules={[{ required: true, whitespace: true, message: 'Nhập tên người nhận.' }, { max: 150 }]}
                  >
                    <Input autoComplete="name" />
                  </Form.Item>
                  <Form.Item
                    name="phone"
                    label="Số điện thoại"
                    rules={[
                      { required: true, message: 'Nhập số điện thoại.' },
                      {
                        pattern: /^(?:0\d{9,10}|\+84\d{9,10})$/,
                        transform: (value?: string) => value?.replace(/[\s().-]/g, ''),
                        message: 'Số điện thoại không hợp lệ.',
                      },
                    ]}
                  >
                    <Input inputMode="tel" autoComplete="tel" />
                  </Form.Item>
                </div>
                <Form.Item
                  name="area"
                  label="Phường/Xã"
                  tooltip="Cửa hàng giao trong khu vực TP. Hồ Chí Minh cũ (chưa gồm Bình Dương, Bà Rịa - Vũng Tàu)."
                  rules={[{ required: true, whitespace: true, message: 'Chọn phường/xã giao hàng.' }, { max: 150 }]}
                >
                  <WardSelect />
                </Form.Item>
                <Form.Item
                  name="address"
                  label="Địa chỉ giao"
                  rules={[{ required: true, whitespace: true, message: 'Nhập địa chỉ giao.' }, { max: 255 }]}
                >
                  <TextArea autoComplete="street-address" rows={1} maxLength={255} placeholder="Số nhà, tên đường, tòa nhà, tầng" />
                </Form.Item>
                {/* Nơi nhận và số tầng chung một hàng; giao ở cổng/sảnh thì không hỏi số tầng. */}
                <div className={`af-checkout-place${place === 'gate' ? ' is-gate' : ''}`}>
                  <Form.Item name="place" label="Nhận hàng">
                    <Radio.Group options={DELIVERY_PLACES} />
                  </Form.Item>
                  {place === 'room' && (
                    <Form.Item
                      name="floor"
                      label="Số tầng đi thang bộ"
                      tooltip="Nhập 0 nếu giao tầng trệt hoặc có thang máy."
                      rules={[{ required: true }, { type: 'integer', min: 0, max: 30 }]}
                    >
                      <InputNumber min={0} max={30} precision={0} />
                    </Form.Item>
                  )}
                </div>
                {hasShells && (
                  <Form.Item name="shells" label="Vỏ bình">
                    <Radio.Group options={SHELL_CHOICES} />
                  </Form.Item>
                )}
                <DeliveryFeeSummary
                  fee={fee}
                  quote={quoteBlocked ? undefined : quote.data}
                  fees={quote.data?.fees}
                  loading={quoteBlocked}
                  error={quote.isError ? <QueryError error={quote.error} onRetry={quote.refetch} /> : undefined}
                />
                <Form.Item name="when" label="Giờ nhận hàng">
                  <Radio.Group
                    options={[
                      { value: 'asap', label: 'Giao sớm nhất' },
                      { value: 'scheduled', label: 'Chọn khung giờ' },
                    ]}
                  />
                </Form.Item>
                <Form.Item
                  noStyle
                  shouldUpdate={(previous: CheckoutForm, next: CheckoutForm) =>
                    previous.when !== next.when || previous.deliveryDate !== next.deliveryDate
                  }
                >
                  {({ getFieldValue }) => {
                    if (getFieldValue('when') !== 'scheduled') return null
                    const date: Dayjs | undefined = getFieldValue('deliveryDate')
                    return (
                      <>
                        <Form.Item name="deliveryDate" label="Ngày nhận" rules={[{ required: true, message: 'Chọn ngày nhận hàng.' }]}>
                          <DatePicker
                            format="DD/MM/YYYY"
                            // Hôm nay hết khung thì không chọn được nữa.
                            disabledDate={(day) =>
                              day.isBefore(dayjs(), 'day') ||
                              (day.isSame(dayjs(), 'day') && DELIVERY_SLOTS.every((slot) => slotStarted(day, slot.key)))
                            }
                            onChange={() => form.setFieldValue('slot', undefined)}
                            style={{ width: '100%' }}
                          />
                        </Form.Item>
                        <Form.Item
                          name="slot"
                          label="Khung giờ"
                          rules={[
                            { required: true, message: 'Chọn khung giờ nhận hàng.' },
                            {
                              validator: (_, value?: DeliverySlotKey) =>
                                value && date && slotStarted(date, value)
                                  ? Promise.reject(new Error('Khung giờ này đã bắt đầu, chọn khung sau.'))
                                  : Promise.resolve(),
                            },
                          ]}
                        >
                          <Radio.Group
                            className="af-checkout-slots"
                            options={DELIVERY_SLOTS.map((slot) => ({
                              value: slot.key,
                              label: slotText(slot),
                              disabled: !date || slotStarted(date, slot.key),
                            }))}
                          />
                        </Form.Item>
                      </>
                    )
                  }}
                </Form.Item>
                <Form.Item name="note" label="Ghi chú (không bắt buộc)" rules={[{ max: CUSTOMER_NOTE_MAX }]}>
                  <TextArea rows={1} maxLength={CUSTOMER_NOTE_MAX} placeholder="Ví dụ: gọi trước khi đến" />
                </Form.Item>
                {canSaveAddress && (
                  <Form.Item name="saveAddress" valuePropName="checked" className="af-checkout-remember">
                    <Checkbox>Lưu địa chỉ này vào sổ địa chỉ</Checkbox>
                  </Form.Item>
                )}
                <Form.Item name="remember" valuePropName="checked" className="af-checkout-remember">
                  <Checkbox>Lưu thông tin trên máy này cho lần đặt sau</Checkbox>
                </Form.Item>
              </Card>
              <div className="af-checkout-payment">
                <Form.Item
                  name="payment"
                  label={
                    <>
                      <Wallet size={18} aria-hidden /> Thanh toán
                    </>
                  }
                >
                  <Radio.Group
                    options={PAYMENT_CHOICES.map((choice) =>
                      choice.value === 'transfer' && !canTransfer
                        ? { ...choice, label: `${choice.label} (chưa hỗ trợ)`, disabled: true }
                        : choice,
                    )}
                  />
                </Form.Item>
                {payment === 'transfer' && canTransfer && (
                  <p>Cửa hàng xác nhận giá xong, trang theo dõi đơn sẽ hiện mã QR để bạn chuyển khoản.</p>
                )}
              </div>
              <p className="af-form-hint af-checkout-next-phone">{nextStepHint}</p>
            </div>
            <aside className="af-checkout-aside">
              <Card title={`Đơn hàng (${units} sản phẩm)`} extra={<Button onClick={openCart}>Sửa</Button>}>
                <CheckoutReview lines={lines} subtotal={quotedSubtotal} fee={fee} depositHint={depositHint} />
                <Button type="primary" block size="large" htmlType="submit" disabled={invalid || quoteBlocked} loading={mutation.isPending}>
                  Đặt đơn
                </Button>
                <p className="af-form-hint">{nextStepHint}</p>
              </Card>
            </aside>
            <div className="af-checkout-bar">
              <div>
                <small>{fee === null ? 'Tạm tính' : 'Tổng cộng'}</small>
                <Money value={total} tone="due" />
              </div>
              <Button type="primary" size="large" htmlType="submit" disabled={invalid || quoteBlocked} loading={mutation.isPending}>
                Đặt đơn
              </Button>
            </div>
          </Form>
        </>
      )}
    </div>
  )
}
