import { useQuery } from '@tanstack/react-query'
import { Alert, App, Button, Col, Form, Input, InputNumber, Modal, Row, Select } from 'antd'
import { QueryError } from '../../shared/components/QueryError'
import { useConfirmDiscard } from '../../shared/hooks/useConfirmDiscard'
import { currency } from '../../shared/utils/format'
import { localToday } from '../inventory/expiry'
import { useStaff } from '../auth/useStaff'
import { catalogApi } from './catalogApi'

type ReceiptDraft = { supplierId: number; receivedAt: string; note?: string; lines: { productId: number; quantity: number; costPrice: number; lotCode: string; expiryDate: string }[] }

export function LiveReceiptModal({ onClose }: { onClose: () => void }) {
  const staff = useStaff()
  const { message } = App.useApp()
  const [form] = Form.useForm<ReceiptDraft>()
  const cancel = useConfirmDiscard(form, onClose)
  const products = useQuery({ queryKey: ['live', 'catalog'], queryFn: catalogApi.products })
  const suppliers = useQuery({ queryKey: ['live', 'receipt-suppliers', staff?.name, staff?.role], queryFn: catalogApi.suppliers })
  const lines: Partial<ReceiptDraft['lines'][number]>[] = Form.useWatch('lines', form) ?? []
  const today = localToday()
  const total = lines.reduce((sum, line) => sum + (line?.quantity ?? 0) * (line?.costPrice ?? 0), 0)
  const loading = products.isPending || suppliers.isPending
  return <Modal open title="Chuẩn bị phiếu nhập hàng" width={880} onCancel={cancel} footer={null}>
    <Alert type="info" showIcon title="Chưa thể xác nhận nhập kho" description="Danh mục nhà cung cấp và sản phẩm lấy từ hệ thống. Thông tin đang nhập chưa được lưu thành phiếu và chưa cộng vào tồn kho." style={{ marginBottom: 16 }} />
    {products.isError ? <QueryError error={products.error} onRetry={products.refetch} /> : suppliers.isError ? <QueryError error={suppliers.error} onRetry={suppliers.refetch} /> : <Form form={form} name="live-receipt-draft" layout="vertical" scrollToFirstError={{ focus: true }} initialValues={{ receivedAt: today, lines: [{ quantity: 1, costPrice: 0 }] }} onFinish={() => message.info('Thông tin hợp lệ. Chưa có phiếu nhập nào được ghi nhận.')}>
      <Row gutter={16}>
        <Col xs={24} md={16}><Form.Item name="supplierId" label="Nhà cung cấp" rules={[{ required: true, message: 'Chọn nhà cung cấp.' }]}><Select loading={suppliers.isPending} showSearch={{ optionFilterProp: 'label' }} options={(suppliers.data ?? []).map((item) => ({ value: item.id, label: item.name }))} /></Form.Item></Col>
        <Col xs={24} md={8}><Form.Item name="receivedAt" label="Ngày nhận" rules={[{ required: true, message: 'Chọn ngày nhận.' }, { validator: (_, value) => !value || value <= today ? Promise.resolve() : Promise.reject(new Error('Không chọn ngày tương lai.')) }]}><Input type="date" max={today} /></Form.Item></Col>
      </Row>
      <Form.List name="lines">{(fields, { add, remove }) => <>
        {fields.map((field, index) => <div className="af-receipt-line" key={field.key}>
          <div className="af-receipt-line-head"><strong>Dòng {index + 1}</strong><Button danger disabled={fields.length === 1} onClick={() => remove(field.name)}>Xóa dòng</Button></div>
          <Row gutter={12}>
            <Col xs={24} md={12}><Form.Item name={[field.name, 'productId']} label="Sản phẩm" rules={[{ required: true, message: 'Chọn sản phẩm.' }]}><Select loading={products.isPending} showSearch={{ optionFilterProp: 'label' }} options={(products.data ?? []).map((product) => ({ value: product.id, label: `${product.sku} · ${product.name}` }))} /></Form.Item></Col>
            <Col xs={12} md={6}><Form.Item name={[field.name, 'quantity']} label="Số lượng nhập" rules={[{ required: true, message: 'Nhập số lượng.' }, { type: 'integer', min: 1, message: 'Nhập số nguyên dương.' }]}><InputNumber min={1} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={12} md={6}><Form.Item name={[field.name, 'costPrice']} label="Giá nhập / đơn vị" rules={[{ required: true, message: 'Nhập giá.' }, { type: 'number', min: 0, message: 'Giá không được âm.' }]}><InputNumber min={0} precision={2} style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name={[field.name, 'lotCode']} label="Mã lô" rules={[{ required: true, whitespace: true, message: 'Nhập mã lô.' }, { max: 64 }]}><Input /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name={[field.name, 'expiryDate']} label="Hạn sử dụng" rules={[{ required: products.data?.find((product) => product.id === lines[field.name]?.productId)?.unit !== 'Vỏ', message: 'Chọn hạn sử dụng.' }, { validator: (_, value) => !value || value > today ? Promise.resolve() : Promise.reject(new Error('Lô đã hết hạn hoặc hết hạn hôm nay.')) }]}><Input type="date" min={today} /></Form.Item></Col>
          </Row>
        </div>)}
        <Button type="dashed" block onClick={() => add({ quantity: 1, costPrice: 0 })}>Thêm dòng hàng</Button>
      </>}</Form.List>
      <Form.Item name="note" label="Ghi chú" rules={[{ max: 500 }]}><Input.TextArea rows={2} /></Form.Item>
      <div className="af-order-summary"><span>Giá trị nhập dự kiến</span><strong>{currency(total)}</strong></div>
      <Button htmlType="submit" disabled={loading}>Kiểm tra thông tin</Button>{' '}<Button type="primary" disabled>Xác nhận nhập kho — chưa khả dụng</Button>
    </Form>}
  </Modal>
}
