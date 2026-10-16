import { App, Form, Input, InputNumber, Modal, Select, Typography } from 'antd'
import { currency } from '../../../shared/utils/format'
import { useProducts } from '../../inventory/useProducts'
import type { Order, OrderDraft } from '../types'
import { useCreateOrder } from '../useOrders'

type CreateOrderModalProps = {
  open: boolean
  onClose: () => void
  onCreated?: (order: Order) => void
  /** Điền sẵn tên khách khi mở từ trang Khách hàng. */
  defaultCustomer?: string
}

export function CreateOrderModal({ open, onClose, onCreated, defaultCustomer }: CreateOrderModalProps) {
  const { message } = App.useApp()
  const [form] = Form.useForm<OrderDraft>()
  const { data: products = [], isPending: loadingProducts } = useProducts()
  const createOrder = useCreateOrder()

  // Vỏ bình là hàng luân chuyển, không bán lẻ trong đơn.
  const sellable = products.filter((product) => product.sku !== 'VO-20L')
  const productId = Form.useWatch('productId', form)
  const quantity = Form.useWatch('quantity', form) ?? 0
  const selected = sellable.find((product) => product.id === productId)

  const submit = (draft: OrderDraft) =>
    createOrder.mutate(draft, {
      onSuccess: (order) => {
        message.success(`Đã tạo đơn ${order.id}.`)
        onClose()
        onCreated?.(order)
      },
      onError: (error) => message.error(error.message),
    })

  return (
    <Modal
      open={open}
      title="Tạo đơn hàng mới"
      okText="Tạo đơn"
      cancelText="Hủy"
      confirmLoading={createOrder.isPending}
      onOk={() => form.submit()}
      onCancel={onClose}
      destroyOnHidden
    >
      <Form<OrderDraft>
        form={form}
        layout="vertical"
        requiredMark="optional"
        initialValues={{ customer: defaultCustomer, quantity: 1, productId: sellable.find((product) => product.stock > 0)?.id }}
        onFinish={submit}
        preserve={false}
      >
        <Form.Item
          name="customer"
          label="Tên khách hàng"
          rules={[{ required: true, whitespace: true, message: 'Nhập tên khách hàng.' }, { max: 100, message: 'Tối đa 100 ký tự.' }]}
        >
          <Input autoFocus placeholder="Ví dụ: Nguyễn Văn An" />
        </Form.Item>
        <Form.Item name="productId" label="Sản phẩm" rules={[{ required: true, message: 'Chọn sản phẩm.' }]}>
          <Select
            loading={loadingProducts}
            showSearch={{ optionFilterProp: 'label' }}
            placeholder="Chọn sản phẩm"
            options={sellable.map((product) => ({
              value: product.id,
              label: `${product.name} · ${currency(product.price)} · còn ${product.stock}`,
              disabled: product.stock === 0,
            }))}
          />
        </Form.Item>
        <Form.Item
          name="quantity"
          label="Số lượng"
          dependencies={['productId']}
          extra={selected && `Tồn kho hiện có: ${selected.stock} ${selected.unit.toLowerCase()}`}
          rules={[
            { required: true, message: 'Nhập số lượng.' },
            {
              validator: (_, value: number) =>
                selected && value > selected.stock
                  ? Promise.reject(new Error(`Vượt quá tồn kho (còn ${selected.stock} ${selected.unit.toLowerCase()}).`))
                  : Promise.resolve(),
            },
          ]}
        >
          <InputNumber min={1} precision={0} style={{ width: 160 }} />
        </Form.Item>
        {selected && (
          <Typography.Paragraph className="af-order-total">
            Thành tiền: <strong>{currency(selected.price * quantity)}</strong>
          </Typography.Paragraph>
        )}
      </Form>
    </Modal>
  )
}
