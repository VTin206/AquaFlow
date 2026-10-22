import { useQuery } from '@tanstack/react-query'
import { Alert, App, Button, Form, Input, InputNumber, Modal, Select } from 'antd'
import { QueryError } from '../../shared/components/QueryError'
import { useConfirmDiscard } from '../../shared/hooks/useConfirmDiscard'
import { currency } from '../../shared/utils/format'
import { catalogApi } from './catalogApi'
import { customerApi } from './customerApi'
import { useStaff } from '../auth/useStaff'

type Draft = { customerId?: number; addressId?: number; recipientName: string; recipientPhone: string; deliveryAddress?: string; fulfillmentType: 'COUNTER' | 'DELIVERY'; channel: string; items: { productId: number; quantity: number }[]; note?: string }

/** Giao diện chuẩn bị đơn; chưa gọi mutation khi backend chưa có endpoint ghi. */
export function LiveOrderDraftModal({ onClose }: { onClose: () => void }) {
  const [form] = Form.useForm<Draft>()
  const cancel = useConfirmDiscard(form, onClose)
  const { message } = App.useApp()
  const staff = useStaff()
  const products = useQuery({ queryKey: ['live', 'catalog'], queryFn: catalogApi.products })
  const customers = useQuery({ queryKey: ['live', 'order-customers', staff?.name, staff?.role], queryFn: customerApi.list })
  const customerId = Form.useWatch('customerId', form)
  const addresses = useQuery({ queryKey: ['live', 'order-addresses', staff?.name, staff?.role, customerId], queryFn: () => customerApi.addresses(customerId!), enabled: customerId != null })
  const method = Form.useWatch('fulfillmentType', form) ?? 'DELIVERY'
  const items: Partial<Draft['items'][number]>[] = Form.useWatch('items', form) ?? []
  const total = items.reduce((sum, item) => sum + (products.data?.find((product) => product.id === item?.productId)?.salePrice ?? 0) * (item?.quantity ?? 0), 0)
  return <Modal open title="Chuẩn bị đơn hàng" width={740} onCancel={cancel} footer={null}>
    <Alert type="info" showIcon title="Chưa thể tạo đơn thật" description="Bạn có thể nhập và kiểm tra thông tin. Đơn chưa được lưu hoặc giữ hàng." style={{ marginBottom: 16 }} />
    {products.isError ? <QueryError error={products.error} onRetry={products.refetch} /> : <Form form={form} name="live-order-draft" layout="vertical" scrollToFirstError={{ focus: true }} initialValues={{ fulfillmentType: 'DELIVERY', channel: 'PHONE', items: [{ quantity: 1 }] }} onFinish={() => message.info('Thông tin hợp lệ. Chưa có đơn hàng nào được tạo.')}>
      <Form.Item name="fulfillmentType" label="Hình thức nhận" rules={[{ required: true }]}><Select options={[{ value: 'DELIVERY', label: 'Giao tận nơi' }, { value: 'COUNTER', label: 'Tại quầy' }]} /></Form.Item>
      <Form.Item name="channel" label="Kênh tiếp nhận" rules={[{ required: true }]}><Select options={[{ value: 'PHONE', label: 'Điện thoại' }, { value: 'COUNTER', label: 'Tại quầy' }, { value: 'MESSAGE', label: 'Tin nhắn' }]} /></Form.Item>
      {customers.isError && <Alert type="warning" title="Không tải được hồ sơ khách hàng. Bạn vẫn có thể điền thông tin bên dưới." action={<Button onClick={() => void customers.refetch()}>Thử lại</Button>} />}
      <Form.Item name="customerId" label="Khách hàng đã lưu (không bắt buộc)"><Select allowClear loading={customers.isPending} showSearch={{ optionFilterProp: 'label' }} options={(customers.data ?? []).map((customer) => ({ value: customer.id, label: `${customer.fullName} · ${customer.phone ?? 'Chưa có điện thoại'}` }))} onChange={(id) => {
        const customer = customers.data?.find((item) => item.id === id)
        form.setFieldsValue({ recipientName: customer?.fullName ?? '', recipientPhone: customer?.phone ?? '', addressId: undefined, deliveryAddress: '' })
      }} /></Form.Item>
      {method === 'DELIVERY' && customerId != null && <>
        {addresses.isError && <Alert type="warning" title="Không tải được địa chỉ đã lưu." action={<Button onClick={() => void addresses.refetch()}>Thử lại</Button>} />}
        <Form.Item name="addressId" label="Địa chỉ đã lưu"><Select allowClear loading={addresses.isFetching} options={(addresses.data ?? []).map((address) => ({ value: address.id, label: `${address.addressLine}${address.isDefault ? ' · Mặc định' : ''}` }))} onChange={(id) => {
          const address = addresses.data?.find((item) => item.id === id)
          if (address) form.setFieldsValue({ recipientName: address.recipientName, recipientPhone: address.recipientPhone, deliveryAddress: address.addressLine })
        }} /></Form.Item>
      </>}
      <Form.Item name="recipientName" label="Tên người nhận" rules={[{ required: method === 'DELIVERY', whitespace: true, message: 'Nhập tên người nhận.' }, { max: 150 }]}><Input /></Form.Item>
      <Form.Item name="recipientPhone" label="Số điện thoại" rules={[{ required: method === 'DELIVERY', message: 'Nhập số điện thoại.' }, { pattern: /^(0|\+84)[0-9]{9,10}$/, transform: (v?: string) => v?.replace(/[\s().-]/g, ''), message: 'Số điện thoại không hợp lệ.' }]}><Input inputMode="tel" /></Form.Item>
      {method === 'DELIVERY' && <Form.Item name="deliveryAddress" label="Địa chỉ giao" rules={[{ required: true, whitespace: true, message: 'Nhập địa chỉ giao.' }, { max: 255 }]}><Input.TextArea rows={2} /></Form.Item>}
      <Form.List name="items">{(fields, { add, remove }) => <>
        {fields.map((field, index) => <div className="af-order-line-form" key={field.key}>
          <Form.Item name={[field.name, 'productId']} label={`Sản phẩm ${index + 1}`} rules={[{ required: true, message: 'Chọn sản phẩm.' }]}><Select loading={products.isPending} showSearch={{ optionFilterProp: 'label' }} options={(products.data ?? []).map((product) => ({ value: product.id, label: `${product.sku} · ${product.name} · ${currency(product.salePrice)}` }))} /></Form.Item>
          <Form.Item name={[field.name, 'quantity']} label="Số lượng" rules={[{ required: true, message: 'Nhập số lượng.' }, { type: 'integer', min: 1, message: 'Nhập số nguyên dương.' }]}><InputNumber min={1} precision={0} /></Form.Item>
          <Button danger disabled={fields.length === 1} onClick={() => remove(field.name)}>Xóa</Button>
        </div>)}
        <Button type="dashed" block onClick={() => add({ quantity: 1 })}>Thêm sản phẩm</Button>
      </>}</Form.List>
      <Form.Item name="note" label="Ghi chú" rules={[{ max: 500 }]}><Input.TextArea rows={2} /></Form.Item>
      <div className="af-order-summary"><span>Tiền hàng dự kiến</span><strong>{currency(total)}</strong></div>
      <p className="af-form-hint">Chưa kiểm tra tồn khả dụng. Chưa gồm phí giao, giảm giá và tiền cọc.</p>
      <Button htmlType="submit" disabled={products.isPending}>Kiểm tra thông tin</Button>{' '}<Button type="primary" disabled>Tạo đơn — chưa khả dụng</Button>
    </Form>}
  </Modal>
}
