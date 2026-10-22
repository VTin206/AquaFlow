import { useState } from 'react'
import { App, Button, Checkbox, DatePicker, Drawer, Empty, Form, Input, InputNumber, Space } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router'
import { DEPOSIT_PER_BOTTLE, suggestedDeliveryFee } from '../../../shared/policy'
import { currency } from '../../../shared/utils/format'
import { cartActions, readProfile, saveProfile, useCart } from '../cart'
import { usePlaceWebOrder, useShopProducts } from '../shopService'

type CheckoutForm = { customer: string; phone: string; address: string; floor?: number; appointment?: Dayjs; note?: string; remember: boolean }

/** Giỏ hàng và bước nhập thông tin giao hàng trong cùng một ngăn kéo. */
export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const cart = useCart()
  const { data: products = [] } = useShopProducts()
  const placeOrder = usePlaceWebOrder()
  const [step, setStep] = useState<'cart' | 'checkout'>('cart')
  const [form] = Form.useForm<CheckoutForm>()
  const floor = Form.useWatch('floor', form) ?? 0

  const lines = cart.flatMap((line) => {
    const product = products.find((item) => item.id === line.productId)
    return product ? [{ ...line, product }] : []
  })
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.product.price, 0)
  const units = lines.reduce((sum, line) => sum + line.quantity, 0)
  const jugs = lines.filter((line) => line.product.unit === 'Bình').reduce((sum, line) => sum + line.quantity, 0)
  const fee = lines.length ? suggestedDeliveryFee({ units, jugs, floor }) : 0
  const unavailable = lines.filter((line) => !line.product.available)
  const profile = readProfile()

  const close = () => {
    setStep('cart')
    onClose()
  }

  const submit = (values: CheckoutForm) => {
    placeOrder.mutate(
      {
        customer: values.customer,
        phone: values.phone,
        address: values.address,
        floor: values.floor ?? 0,
        appointment: values.appointment?.toISOString(),
        note: values.note,
        lines: lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
      },
      {
        onSuccess: (order) => {
          saveProfile(values.remember ? { customer: values.customer.trim(), phone: values.phone.trim(), address: values.address.trim(), floor: values.floor } : null)
          cartActions.clear()
          form.resetFields()
          close()
          navigate(`/track/${order.trackingToken}`, { state: { placed: true } })
        },
        onError: (error) => message.error(error.message),
      },
    )
  }

  return (
    <Drawer
      open={open}
      onClose={close}
      title={
        step === 'cart' ? (
          `Giỏ hàng (${units})`
        ) : (
          <Space>
            <Button type="text" size="small" icon={<ArrowLeft size={16} />} aria-label="Quay lại giỏ hàng" onClick={() => setStep('cart')} />
            Thông tin giao hàng
          </Space>
        )
      }
      size={440}
      footer={
        lines.length > 0 && (
          <div className="af-shop-cart-footer">
            <div className="af-order-summary">
              <span>Tiền hàng</span>
              <span>{currency(subtotal)}</span>
            </div>
            <div className="af-order-summary">
              <span>Phí giao{floor ? ` (gồm phụ thu lầu ${floor})` : ''}</span>
              <span>{fee ? currency(fee) : 'Miễn phí'}</span>
            </div>
            <div className="af-order-summary af-order-summary-highlight">
              <span>Tạm tính</span>
              <strong>{currency(subtotal + fee)}</strong>
            </div>
            {jugs > 0 && (
              <div className="af-deposit-note" role="note" aria-label="Lưu ý tiền cọc vỏ bình">
                <strong>Chưa gồm tiền cọc vỏ</strong>
                <span>Nếu thiếu vỏ để đổi, bạn gửi cọc {currency(DEPOSIT_PER_BOTTLE)}/vỏ khi nhận hàng. Tiền cọc được hoàn khi trả vỏ.</span>
              </div>
            )}
            {step === 'cart' ? (
              <Button type="primary" block size="large" disabled={unavailable.length > 0} onClick={() => setStep('checkout')}>
                Đặt hàng
              </Button>
            ) : (
              <Button type="primary" block size="large" loading={placeOrder.isPending} onClick={() => form.submit()}>
                Xác nhận đặt hàng
              </Button>
            )}
          </div>
        )
      }
    >
      {lines.length === 0 ? (
        <Empty description="Giỏ hàng đang trống." />
      ) : step === 'cart' ? (
        <>
          <ul className="af-shop-cart">
            {lines.map((line) => (
              <li key={line.productId}>
                <div>
                  <strong>{line.product.name}</strong>
                  <small>
                    {currency(line.product.price)} / {line.product.unit.toLowerCase()}
                    {!line.product.available && ' · Tạm hết hàng, bỏ khỏi giỏ để đặt'}
                  </small>
                </div>
                <InputNumber
                  aria-label={`Số lượng ${line.product.name}`}
                  min={1}
                  max={99}
                  precision={0}
                  value={line.quantity}
                  onChange={(value) => value && cartActions.set(line.productId, value)}
                  style={{ width: 72 }}
                />
                <Button type="text" danger icon={<Trash2 size={16} />} aria-label={`Bỏ ${line.product.name}`} onClick={() => cartActions.remove(line.productId)} />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <Form<CheckoutForm>
          form={form}
          layout="vertical"
          requiredMark
          initialValues={{ ...profile, floor: profile?.floor ?? 0, remember: Boolean(profile) }}
          onFinish={submit}
        >
          <Form.Item name="customer" label="Tên người nhận" rules={[{ required: true, whitespace: true, message: 'Nhập tên người nhận.' }, { max: 80 }]}>
            <Input autoComplete="name" />
          </Form.Item>
          <Form.Item
            name="phone"
            label="Số điện thoại"
            rules={[
              { required: true, message: 'Nhập số điện thoại để cửa hàng gọi xác nhận.' },
              { pattern: /^(?:0\d{9,10}|\+84\d{9,10})$/, transform: (value?: string) => value?.replace(/[\s.-]/g, ''), message: 'Số điện thoại chưa đúng.' },
            ]}
          >
            <Input inputMode="tel" autoComplete="tel" />
          </Form.Item>
          <Form.Item name="address" label="Địa chỉ giao" rules={[{ required: true, whitespace: true, message: 'Nhập địa chỉ giao hàng.' }, { max: 200 }]}>
            <Input.TextArea rows={2} autoComplete="street-address" placeholder="Số nhà, đường, phường, quận" />
          </Form.Item>
          <Space wrap align="start">
            <Form.Item name="floor" label="Lầu (đi thang bộ)" tooltip="0 nếu tầng trệt hoặc có thang máy. Phụ thu theo bình khi giao lên lầu.">
              <InputNumber min={0} max={30} precision={0} style={{ width: 130 }} />
            </Form.Item>
            <Form.Item
              name="appointment"
              label="Giờ hẹn (không bắt buộc)"
              rules={[{ validator: (_, value?: Dayjs) => (!value || value.isAfter(dayjs()) ? Promise.resolve() : Promise.reject(new Error('Chọn giờ trong tương lai.'))) }]}
            >
              <DatePicker showTime={{ format: 'HH:mm', minuteStep: 15 }} format="DD/MM HH:mm" disabledDate={(day) => day.isBefore(dayjs(), 'day')} placeholder="Giao sớm nhất" />
            </Form.Item>
          </Space>
          <Form.Item name="note" label="Ghi chú">
            <Input.TextArea rows={2} maxLength={200} placeholder="Ví dụ: gọi trước khi giao, để ở bảo vệ" />
          </Form.Item>
          <Form.Item name="remember" valuePropName="checked">
            <Checkbox>Lưu thông tin trên máy này cho lần đặt sau</Checkbox>
          </Form.Item>
          <p className="af-form-hint">Cửa hàng gọi xác nhận và chốt giá trước khi giao. Thanh toán khi nhận hàng hoặc chuyển khoản theo mã QR trên trang theo dõi đơn.</p>
        </Form>
      )}
    </Drawer>
  )
}
