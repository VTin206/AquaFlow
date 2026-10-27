import { Alert, App, Button, Card, Checkbox, DatePicker, Empty, Form, Input, InputNumber, Skeleton, Typography } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { Link, useNavigate, useOutletContext } from 'react-router'
import { QueryError } from '../../shared/components/QueryError'
import { currency } from '../../shared/utils/format'
import { DEPOSIT_PER_BOTTLE, suggestedDeliveryFee } from '../../shared/policy'
import { readProfile, saveProfile, useCart, useCartActions } from './cart'
import { usePlaceWebOrder, useShopDemo, useShopProducts } from './shopService'

type CheckoutForm = { customer: string; phone: string; address: string; floor?: number; appointment?: Dayjs; note?: string; remember: boolean }

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
  const floor = Form.useWatch('floor', form) ?? 0
  const profile = readProfile()
  const lines = cart.map((line) => ({ ...line, product: products.data?.find((item) => item.id === line.productId) }))
  const invalid = lines.some((line) => !line.product || line.product.available === false)
  const subtotal = lines.reduce((sum, line) => sum + (line.product?.price ?? 0) * line.quantity, 0)
  const units = lines.reduce((sum, line) => sum + line.quantity, 0)
  const jugs = lines.filter((line) => line.product?.unit === 'Bình').reduce((sum, line) => sum + line.quantity, 0)
  const fee = demo ? suggestedDeliveryFee({ units, jugs, floor }) : null
  const submit = (values: CheckoutForm) => {
    if (!demo || invalid || !cart.length || products.isError || products.isPending) return
    mutation.mutate({ customer: values.customer.trim(), phone: values.phone.replace(/[\s().-]/g, ''), address: values.address.trim(),
      floor, appointment: values.appointment?.toISOString(), note: values.note?.trim(), lines: cart,
    }, { onSuccess: (order) => {
      saveProfile(values.remember ? { customer: values.customer.trim(), phone: values.phone.trim(), address: values.address.trim(), floor } : null)
      actions.clear()
      navigate(`/track/${order.trackingToken}`, { state: { placed: true } })
    }, onError: (error) => message.error(error.message) })
  }

  return <div className="af-shop-page af-shop-narrow">
    <Typography.Title level={2}>Checkout — Thông tin giao hàng</Typography.Title>
    {products.isPending ? <Skeleton active /> : products.isError ? <QueryError error={products.error} onRetry={products.refetch} /> : !cart.length ? <Empty description="Giỏ hàng đang trống."><Link to="/shop">Chọn sản phẩm</Link></Empty> : <>
      {!demo && <Alert type="info" showIcon title="Đặt hàng trực tuyến chưa khả dụng" description="Bạn có thể kiểm tra giỏ hàng và điền thông tin. Chưa có đơn nào được gửi; phí giao và tiền cọc chưa được xác định." />}
      {invalid && <Alert style={{ marginTop: 12 }} type="warning" showIcon title="Có sản phẩm không còn đặt được" action={<Button onClick={openCart}>Sửa giỏ hàng</Button>} />}
      <Card style={{ marginTop: 16 }} title="Giỏ hàng" extra={<Button onClick={openCart}>Chỉnh sửa</Button>}>
        {lines.map((line) => <div className="af-order-summary" key={line.productId}><span>{line.product?.name ?? `Sản phẩm ${line.productId}`} × {line.quantity}</span><span>{line.product ? currency(line.product.price * line.quantity) : 'Không còn trong danh mục'}</span></div>)}
        <div className="af-order-summary"><span>Phí giao</span><span>{fee === null ? 'Chưa xác định' : currency(fee)}</span></div>
        <div className="af-order-summary af-order-summary-highlight"><span>{demo ? 'Tạm tính' : 'Tiền hàng tạm tính'}</span><strong>{currency(subtotal + (fee ?? 0))}</strong></div>
        <p className="af-form-hint">Chưa gồm tiền cọc vỏ.{demo && jugs > 0 ? ` Nếu thiếu vỏ để đổi, cọc ${currency(DEPOSIT_PER_BOTTLE)}/vỏ khi nhận hàng.` : ''}</p>
      </Card>
      <Card style={{ marginTop: 16 }}>
        <Form form={form} name="checkout" layout="vertical" scrollToFirstError={{ focus: true }} initialValues={{ ...profile, floor: profile?.floor ?? 0, remember: Boolean(profile) }} onFinish={submit}>
          <Form.Item name="customer" label="Tên người nhận" rules={[{ required: true, whitespace: true, message: 'Nhập tên người nhận.' }, { max: 150 }]}><Input autoComplete="name" /></Form.Item>
          <Form.Item name="phone" label="Số điện thoại" rules={[{ required: true, message: 'Nhập số điện thoại.' }, { pattern: /^(?:0\d{9,10}|\+84\d{9,10})$/, transform: (value?: string) => value?.replace(/[\s().-]/g, ''), message: 'Số điện thoại không hợp lệ.' }]}><Input inputMode="tel" autoComplete="tel" /></Form.Item>
          <Form.Item name="address" label="Địa chỉ giao" rules={[{ required: true, whitespace: true, message: 'Nhập địa chỉ giao.' }, { max: 255 }]}><Input.TextArea autoComplete="street-address" rows={2} /></Form.Item>
          <Form.Item name="floor" label="Lầu giao bằng thang bộ"><InputNumber min={0} max={30} precision={0} /></Form.Item>
          <Form.Item name="appointment" label="Giờ nhận mong muốn" rules={[{ validator: (_, value?: Dayjs) => !value || value.isAfter(dayjs()) ? Promise.resolve() : Promise.reject(new Error('Chọn giờ trong tương lai.')) }]}><DatePicker showTime format="DD/MM/YYYY HH:mm" disabledDate={(date) => date.isBefore(dayjs(), 'day')} /></Form.Item>
          <Form.Item name="note" label="Ghi chú" rules={[{ max: 500 }]}><Input.TextArea rows={2} /></Form.Item>
          {demo && <Form.Item name="remember" valuePropName="checked"><Checkbox>Lưu thông tin trên máy này cho lần đặt sau</Checkbox></Form.Item>}
          <Button type="primary" block htmlType="submit" disabled={!demo || invalid} loading={mutation.isPending}>{demo ? 'Đặt đơn dùng thử' : 'Gửi đơn — chưa khả dụng'}</Button>
        </Form>
      </Card>
    </>}
  </div>
}
