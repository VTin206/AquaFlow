import { Alert, App, Button, Card, Checkbox, DatePicker, Empty, Form, Input, InputNumber, Result, Skeleton, Typography } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { useRef, useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router'
import type { LiveOrder } from '../live/orderApi'
import { Money } from '../../shared/components/Money'
import { QueryError } from '../../shared/components/QueryError'
import { currency } from '../../shared/utils/format'
import { DEPOSIT_PER_BOTTLE, suggestedDeliveryFee } from '../../shared/policy'
import { readProfile, saveProfile, useCart, useCartActions } from './cart'
import { submitCheckoutOnce } from './checkoutSubmit'
import { CartThumb } from './components/CartThumb'
import { usePlaceWebOrder, useShopDemo, useShopProducts } from './shopService'

type CheckoutForm = { customer: string; phone: string; address: string; area: string; floor?: number; appointment?: Dayjs; note?: string; remember: boolean }

export function CheckoutPage() {
  const demo = useShopDemo()
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
  const floor = Form.useWatch('floor', form) ?? 0
  const profile = readProfile()
  const lines = cart.map((line) => ({ ...line, product: products.data?.find((item) => item.id === line.productId) }))
  const invalidCartLine = cart.some((line) => !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 99 || (!demo && (!/^\d+$/.test(line.productId) || !Number.isSafeInteger(Number(line.productId)) || Number(line.productId) <= 0)))
  const invalid = invalidCartLine || lines.some((line) => !line.product || line.product.available === false)
  const subtotal = lines.reduce((sum, line) => sum + (line.product?.price ?? 0) * line.quantity, 0)
  const units = lines.reduce((sum, line) => sum + line.quantity, 0)
  const jugs = lines.filter((line) => line.product?.unit === 'Bình').reduce((sum, line) => sum + line.quantity, 0)
  const fee = demo ? suggestedDeliveryFee({ units, jugs, floor }) : null
  const submit = (values: CheckoutForm) => {
    if (submitLock.current || mutation.isPending || invalid || !cart.length || products.isError || products.isPending) return
    setSubmitError(undefined)
    const draft = { customer: values.customer.trim(), phone: values.phone.replace(/[\s().-]/g, ''), address: values.address.trim(),
      area: values.area.trim(), floor, appointment: values.appointment?.toISOString(), note: values.note?.trim(), lines: cart,
    }
    void submitCheckoutOnce(submitLock, () => mutation.mutateAsync(draft), (order) => {
      if (demo) saveProfile(values.remember ? { customer: values.customer.trim(), phone: values.phone.trim(), address: values.address.trim(), area: values.area.trim(), floor } : null)
      actions.clear()
      if (demo && 'trackingToken' in order && order.trackingToken) navigate(`/track/${order.trackingToken}`, { state: { placed: true } })
      else if (!demo) setPlacedLiveOrder(order as LiveOrder)
    }, (error) => { setSubmitError(error.message); message.error(error.message) })
  }

  if (placedLiveOrder) return <div className="af-shop-page af-shop-narrow">
    <Result status="success" title="Đặt hàng thành công" subTitle={placedLiveOrder.orderCode ? `Mã đơn: ${placedLiveOrder.orderCode}` : 'Đơn hàng đã được ghi nhận.'} extra={<Button type="primary" onClick={() => { setPlacedLiveOrder(undefined); navigate('/shop') }}>Tiếp tục mua sắm</Button>} />
  </div>

  return <div className="af-shop-page af-shop-narrow">
    <Typography.Title level={2}>Thanh toán</Typography.Title>
    {products.isPending ? <Skeleton active /> : products.isError ? <QueryError error={products.error} onRetry={products.refetch} /> : !cart.length ? <Empty description="Giỏ hàng đang trống."><Link to="/shop">Chọn sản phẩm</Link></Empty> : <>
      {invalid && <Alert style={{ marginTop: 12 }} type="warning" showIcon title="Có sản phẩm không còn đặt được" action={<Button onClick={openCart}>Sửa giỏ hàng</Button>} />}
      {submitError && <Alert style={{ marginTop: 12 }} type="error" showIcon title="Không thể tạo đơn" description={submitError} />}
      <Card style={{ marginTop: 16 }} title={`Đơn hàng (${units} sản phẩm)`} extra={<Button onClick={openCart}>Chỉnh sửa</Button>}>
        <ul className="af-checkout-lines">
          {lines.map((line) => <li key={line.productId}>
            <CartThumb product={line.product} />
            <div>
              <strong>{line.product?.name ?? `Sản phẩm ${line.productId}`}</strong>
              <small>{line.product ? `${currency(line.product.price)} / ${line.product.unit.toLowerCase()} × ${line.quantity}` : 'Không còn trong danh mục'}</small>
            </div>
            {line.product && <span className="af-money af-checkout-line-total">{currency(line.product.price * line.quantity)}</span>}
          </li>)}
        </ul>
        <dl className="af-checkout-totals">
          <div><dt>Tiền hàng</dt><dd className="af-money">{currency(subtotal)}</dd></div>
          <div><dt>Phí giao</dt><dd>{fee === null ? 'Cửa hàng báo khi xác nhận' : fee === 0 ? 'Miễn phí' : <span className="af-money">{currency(fee)}</span>}</dd></div>
          <div className="is-total"><dt>{fee === null ? 'Tạm tính' : 'Tổng cộng'}</dt><dd><Money value={subtotal + (fee ?? 0)} tone="due" /></dd></div>
        </dl>
        <p className="af-form-hint">Chưa gồm tiền cọc vỏ.{demo && jugs > 0 ? ` Nếu thiếu vỏ để đổi, cọc ${currency(DEPOSIT_PER_BOTTLE)}/vỏ khi nhận hàng.` : ''}</p>
      </Card>
      <Card style={{ marginTop: 16 }}>
        <Form form={form} name="checkout" layout="vertical" scrollToFirstError={{ focus: true }} initialValues={{ ...profile, floor: profile?.floor ?? 0, remember: Boolean(profile) }} onFinish={submit}>
          <Form.Item name="customer" label="Tên người nhận" rules={[{ required: true, whitespace: true, message: 'Nhập tên người nhận.' }, { max: 150 }]}><Input autoComplete="name" /></Form.Item>
          <Form.Item name="phone" label="Số điện thoại" rules={[{ required: true, message: 'Nhập số điện thoại.' }, { pattern: /^(?:0\d{9,10}|\+84\d{9,10})$/, transform: (value?: string) => value?.replace(/[\s().-]/g, ''), message: 'Số điện thoại không hợp lệ.' }]}><Input inputMode="tel" autoComplete="tel" /></Form.Item>
          <Form.Item name="address" label="Địa chỉ giao" rules={[{ required: true, whitespace: true, message: 'Nhập địa chỉ giao.' }, { max: 255 }]}><Input.TextArea autoComplete="street-address" rows={2} /></Form.Item>
          <Form.Item name="area" label="Khu vực" rules={[{ required: true, whitespace: true, message: 'Nhập khu vực giao.' }, { max: 150 }]}><Input autoComplete="address-level2" /></Form.Item>
          {demo && <>
            <Form.Item name="floor" label="Lầu giao bằng thang bộ"><InputNumber min={0} max={30} precision={0} /></Form.Item>
            <Form.Item name="appointment" label="Giờ nhận mong muốn" rules={[{ validator: (_, value?: Dayjs) => !value || value.isAfter(dayjs()) ? Promise.resolve() : Promise.reject(new Error('Chọn giờ trong tương lai.')) }]}><DatePicker showTime format="DD/MM/YYYY HH:mm" disabledDate={(date) => date.isBefore(dayjs(), 'day')} /></Form.Item>
          </>}
          <Form.Item name="note" label="Ghi chú" rules={[{ max: 500 }]}><Input.TextArea rows={2} /></Form.Item>
          {demo && <Form.Item name="remember" valuePropName="checked"><Checkbox>Lưu thông tin trên máy này cho lần đặt sau</Checkbox></Form.Item>}
          <Button type="primary" block htmlType="submit" disabled={invalid} loading={mutation.isPending}>{demo ? 'Đặt đơn dùng thử' : 'Đặt đơn'}</Button>
        </Form>
      </Card>
    </>}
  </div>
}
