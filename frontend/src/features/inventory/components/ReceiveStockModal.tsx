import { App, Form, InputNumber, Modal, Select, Typography } from 'antd'
import type { StockDraft } from '../types'
import { useProducts, useReceiveStock } from '../useProducts'

type ReceiveStockModalProps = { open: boolean; onClose: () => void; defaultProductId?: string }

export function ReceiveStockModal({ open, onClose, defaultProductId }: ReceiveStockModalProps) {
  const { message } = App.useApp()
  const [form] = Form.useForm<StockDraft>()
  const { data: products = [], isPending: loadingProducts } = useProducts()
  const receiveStock = useReceiveStock()

  const productId = Form.useWatch('productId', form)
  const quantity = Form.useWatch('quantity', form) ?? 0
  const selected = products.find((product) => product.id === productId)

  const submit = (draft: StockDraft) =>
    receiveStock.mutate(draft, {
      onSuccess: (product) => {
        message.success(`Đã nhập ${draft.quantity} ${product.unit.toLowerCase()} ${product.name}. Tồn kho mới: ${product.stock}.`)
        onClose()
      },
      onError: (error) => message.error(error.message),
    })

  return (
    <Modal
      open={open}
      title="Tạo phiếu nhập kho"
      okText="Xác nhận nhập"
      cancelText="Hủy"
      confirmLoading={receiveStock.isPending}
      onOk={() => form.submit()}
      onCancel={onClose}
      destroyOnHidden
    >
      <Form<StockDraft>
        form={form}
        layout="vertical"
        initialValues={{ productId: defaultProductId ?? products[0]?.id, quantity: 1 }}
        onFinish={submit}
        preserve={false}
      >
        <Form.Item name="productId" label="Sản phẩm nhập" rules={[{ required: true, message: 'Chọn sản phẩm.' }]}>
          <Select
            loading={loadingProducts}
            showSearch={{ optionFilterProp: 'label' }}
            options={products.map((product) => ({ value: product.id, label: `${product.name} (${product.sku})` }))}
          />
        </Form.Item>
        <Form.Item name="quantity" label="Số lượng thực nhận" rules={[{ required: true, message: 'Nhập số lượng.' }]}>
          <InputNumber min={1} max={100000} precision={0} style={{ width: 160 }} autoFocus />
        </Form.Item>
        {selected && (
          <Typography.Paragraph type="secondary">
            Tồn kho: {selected.stock} → <strong>{selected.stock + quantity}</strong> {selected.unit.toLowerCase()}
          </Typography.Paragraph>
        )}
      </Form>
    </Modal>
  )
}
