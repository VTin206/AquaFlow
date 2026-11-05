import { Alert, App, Button, Card, Checkbox, DatePicker, Empty, Form, Input, Radio, Result, Skeleton, Typography } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { ChevronDown, Wallet } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router'
import type { LiveOrder } from '@/features/live/orderApi'
import { Money } from '@/shared/components/Money'
import { QueryError } from '@/shared/components/QueryError'
import { currency } from '@/shared/utils/format'
import { focusNextOnEnter } from '@/shared/utils/forms'
import { DEPOSIT_PER_BOTTLE, suggestedDeliveryFee } from '@/shared/policy'
import { readProfile, saveProfile, useCart, useCartActions } from './cart'
import { submitCheckoutOnce } from './checkoutSubmit'
import { CheckoutReview } from './components/CheckoutReview'
import { usePlaceWebOrder, useShopFeature, useShopProducts } from './shopService'
import { useAuth } from '@/features/auth/useAuth'
import { isCustomer } from '@/features/auth/accountAccess'

type CheckoutForm = {
  customer: string
  phone: string
  address: string
  area: string
  when: 'asap' | 'scheduled'
  appointment?: Dayjs
  note?: string
  remember: boolean
}

const nextStepHint = 'Sau khi đặt, cửa hàng sẽ xác nhận đơn rồi giao hàng cho bạn.'

export function CheckoutPage() {
  const { user } = useAuth()
  const quoteFee = useShopFeature('deliveryQuote')
  const showDeposit = useShopFeature('bottleLedger')
  const cart = useCart()
  const actions = useCartActions()
  const products = useShopProducts()
  const mutation = usePlaceWebOrder()
  const { message } = App.useApp()
  const navigate = useNavigate()
  const { openCart } = useOutletContext<{ openCart: () => void }>()
  const [form] = Form.useForm<CheckoutForm>()
  const [submitError, setSubmitError] = useState<string>()
  const [placedLiveOrder, setPlacedLiveOrder] = useState<LiveOrder>()
  const submitLock = useRef(false)
  const profile = readProfile()
  // Thông tin đã lưu trên máy được ưu tiên vì khách có thể đặt hộ người khác; chưa lưu thì lấy từ tài khoản.
  // Tài khoản không có họ tên thì `name` là email, không dùng làm tên người nhận.
  const accountDefaults =
    user && isCustomer(user) ? { customer: user.name === user.email ? undefined : user.name, phone: user.phone ?? undefined } : undefined
  const lines = cart.map((line) => ({ ...line, product: products.data?.find((item) => item.id === line.productId) }))
  // Mã sản phẩm lạ (giỏ cũ, đổi nguồn dữ liệu) không có trong danh mục nên bị chặn ở `invalid` bên dưới.
  const invalidCartLine = cart.some((line) => !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 99)
  const invalid = invalidCartLine || lines.some((line) => !line.product || line.product.available === false)
  const subtotal = lines.reduce((sum, line) => sum + (line.product?.price ?? 0) * line.quantity, 0)
  const units = lines.reduce((sum, line) => sum + line.quantity, 0)
  const jugs = lines.filter((line) => line.product?.unit === 'Bình').reduce((sum, line) => sum + line.quantity, 0)
  const fee = quoteFee ? suggestedDeliveryFee({ units, jugs, floor: 0 }) : null
  const total = subtotal + (fee ?? 0)
  const depositHint = `Chưa gồm tiền cọc vỏ.${showDeposit && jugs > 0 ? ` Nếu thiếu vỏ để đổi, cọc ${currency(DEPOSIT_PER_BOTTLE)}/vỏ khi nhận hàng.` : ''}`
  const submit = (values: CheckoutForm) => {
    if (submitLock.current || mutation.isPending || invalid || !cart.length || products.isError || products.isPending) return
    setSubmitError(undefined)
    const draft = {
      customer: values.customer.trim(),
      phone: values.phone.replace(/[\s().-]/g, ''),
      address: values.address.trim(),
      area: values.area.trim(),
      // Giờ đã chọn trước đó vẫn có thể còn trong form, nên chỉ gửi khi khách đang chọn "Chọn giờ".
      appointment: values.when === 'scheduled' ? values.appointment?.toISOString() : undefined,
      note: values.note?.trim(),
      lines: cart,
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
        actions.clear()
        // Có mã tra cứu thì sang trang theo dõi đơn, chưa có thì báo thành công tại đây.
        if ('trackingToken' in order && order.trackingToken) navigate(`/track/${order.trackingToken}`, { state: { placed: true } })
        else setPlacedLiveOrder(order as LiveOrder)
      },
      (error) => {
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
          subTitle={placedLiveOrder.orderCode ? `Mã đơn: ${placedLiveOrder.orderCode}` : 'Đơn hàng đã được ghi nhận.'}
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
      <Typography.Title level={2}>Đặt hàng</Typography.Title>
      {products.isPending ? (
        <Skeleton active />
      ) : products.isError ? (
        <QueryError error={products.error} onRetry={products.refetch} />
      ) : !cart.length ? (
        <Empty description="Giỏ hàng đang trống.">
          <Link to="/shop">Chọn sản phẩm</Link>
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
            <CheckoutReview lines={lines} subtotal={subtotal} fee={fee} depositHint={depositHint} />
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
            initialValues={{ ...accountDefaults, ...profile, when: 'asap', remember: Boolean(profile) }}
            onFinish={submit}
            onKeyDown={focusNextOnEnter}
          >
            <div className="af-checkout-main">
              <Card title="Người nhận">
                <div className="af-checkout-pair">
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
              </Card>
              <Card title="Giao đến">
                <Form.Item
                  name="address"
                  label="Địa chỉ giao"
                  rules={[{ required: true, whitespace: true, message: 'Nhập địa chỉ giao.' }, { max: 255 }]}
                >
                  <Input.TextArea autoComplete="street-address" rows={2} placeholder="Số nhà, tên đường, tòa nhà, tầng" />
                </Form.Item>
                <Form.Item name="area" label="Khu vực" rules={[{ required: true, whitespace: true, message: 'Nhập khu vực giao.' }, { max: 150 }]}>
                  <Input autoComplete="address-level2" placeholder="Phường hoặc quận" />
                </Form.Item>
                <Form.Item name="when" label="Giờ nhận hàng">
                  <Radio.Group
                    options={[
                      { value: 'asap', label: 'Giao sớm nhất' },
                      { value: 'scheduled', label: 'Chọn giờ' },
                    ]}
                  />
                </Form.Item>
                <Form.Item noStyle shouldUpdate={(previous: CheckoutForm, next: CheckoutForm) => previous.when !== next.when}>
                  {({ getFieldValue }) =>
                    getFieldValue('when') === 'scheduled' && (
                      <Form.Item
                        name="appointment"
                        label="Giờ nhận mong muốn"
                        rules={[
                          { required: true, message: 'Chọn giờ nhận hàng.' },
                          {
                            validator: (_, value?: Dayjs) =>
                              !value || value.isAfter(dayjs()) ? Promise.resolve() : Promise.reject(new Error('Chọn giờ trong tương lai.')),
                          },
                        ]}
                      >
                        <DatePicker showTime format="DD/MM/YYYY HH:mm" disabledDate={(date) => date.isBefore(dayjs(), 'day')} style={{ width: '100%' }} />
                      </Form.Item>
                    )
                  }
                </Form.Item>
                <Form.Item name="note" label="Ghi chú (không bắt buộc)" rules={[{ max: 500 }]}>
                  <Input.TextArea rows={2} placeholder="Ví dụ: gọi trước khi đến" />
                </Form.Item>
                <Form.Item name="remember" valuePropName="checked" className="af-checkout-remember">
                  <Checkbox>Lưu thông tin trên máy này cho lần đặt sau</Checkbox>
                </Form.Item>
              </Card>
              <Card title="Thanh toán">
                <div className="af-checkout-payment">
                  <Wallet size={22} aria-hidden />
                  <div>
                    <strong>Thanh toán khi nhận hàng</strong>
                    <p>Trả tiền mặt hoặc chuyển khoản cho nhân viên giao hàng. Không cần trả trước.</p>
                  </div>
                </div>
              </Card>
              <p className="af-form-hint af-checkout-next-phone">{nextStepHint}</p>
            </div>
            <aside className="af-checkout-aside">
              <Card title={`Đơn hàng (${units} sản phẩm)`} extra={<Button onClick={openCart}>Sửa</Button>}>
                <CheckoutReview lines={lines} subtotal={subtotal} fee={fee} depositHint={depositHint} />
                <Button type="primary" block size="large" htmlType="submit" disabled={invalid} loading={mutation.isPending}>
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
              <Button type="primary" size="large" htmlType="submit" disabled={invalid} loading={mutation.isPending}>
                Đặt đơn
              </Button>
            </div>
          </Form>
        </>
      )}
    </div>
  )
}
