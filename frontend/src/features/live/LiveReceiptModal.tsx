import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Col, Form, Input, InputNumber, Modal, Result, Row, Select, Space, Table } from 'antd'
import { QueryError } from '../../shared/components/QueryError'
import { useConfirmDiscard } from '../../shared/hooks/useConfirmDiscard'
import { currency } from '../../shared/utils/format'
import { isoToVnDate, localToday } from '../inventory/expiry'
import { useStaff } from '../auth/useStaff'
import { catalogApi } from './catalogApi'
import { inventoryApi, receiptCode, receiptTotal, type PurchaseReceipt, type ReceiptInput } from './inventoryApi'
import { invalidateLiveData } from './invalidateLiveData'

type ReceiptLine = { productId: number; lotCode: string; manufacturedOn?: string; expiresOn: string; quantityReceived: number; quantityAccepted: number; unitCost: number }
type ReceiptDraft = { supplierId: number; receivedAt: string; note?: string; lines: ReceiptLine[] }

const newLine = { quantityReceived: 1, quantityAccepted: 1, unitCost: 0 }

/** Ngày nhận hôm nay gửi giờ hiện tại; ngày trước đó gửi giữa trưa để không lệch ngày khi đổi múi giờ. */
const toInstant = (date: string) => (date === localToday() ? new Date() : new Date(`${date}T12:00:00`)).toISOString()

const toDraft = (receipt: PurchaseReceipt): ReceiptDraft => ({
  supplierId: receipt.supplierId,
  receivedAt: localToday(new Date(receipt.receivedAt)),
  note: receipt.note ?? undefined,
  lines: receipt.items.map((item) => ({ productId: item.productId, lotCode: item.lotCode, manufacturedOn: item.manufacturedOn ?? undefined, expiresOn: item.expiresOn, quantityReceived: item.quantityReceived, quantityAccepted: item.quantityAccepted, unitCost: item.unitCost })),
})

const toInput = (draft: ReceiptDraft): ReceiptInput => ({
  supplierId: draft.supplierId,
  receivedAt: toInstant(draft.receivedAt),
  note: draft.note?.trim() || null,
  items: draft.lines.map((line) => ({ productId: line.productId, lotCode: line.lotCode.trim(), manufacturedOn: line.manufacturedOn || null, expiresOn: line.expiresOn, quantityReceived: line.quantityReceived, quantityAccepted: line.quantityAccepted, unitCost: line.unitCost })),
})

/** Kết quả sau khi xác nhận: số lượng từng lô đã cộng vào tồn kho. */
export function ReceiptResult({ receipt, onClose }: { receipt: PurchaseReceipt; onClose: () => void }) {
  const accepted = receipt.items.reduce((sum, item) => sum + item.quantityAccepted, 0)
  const rejected = receipt.items.reduce((sum, item) => sum + item.quantityRejected, 0)
  return <>
    <Result status="success" title={`Đã nhập kho phiếu ${receiptCode(receipt)}`} subTitle={`${receipt.supplierName} · đã cộng ${accepted} đơn vị vào tồn kho${rejected ? `, loại ${rejected} đơn vị` : ''}.`} style={{ paddingBlock: 16 }} />
    <Table rowKey="id" dataSource={receipt.items} pagination={false} scroll={{ x: 700 }} columns={[
      { title: 'Sản phẩm', dataIndex: 'productName' },
      { title: 'Mã lô', dataIndex: 'lotCode' },
      { title: 'Hạn sử dụng', dataIndex: 'expiresOn', render: isoToVnDate },
      { title: 'Nhận', dataIndex: 'quantityReceived', align: 'right' },
      { title: 'Nhập kho', dataIndex: 'quantityAccepted', align: 'right' },
      { title: 'Loại', dataIndex: 'quantityRejected', align: 'right' },
      { title: 'Thành tiền', key: 'lineTotal', align: 'right', render: (_, item) => currency(item.quantityAccepted * item.unitCost) },
    ]} />
    <div className="af-order-summary" style={{ marginTop: 12 }}><span>Giá trị nhập kho</span><strong>{currency(receiptTotal(receipt))}</strong></div>
    <div style={{ marginTop: 16, textAlign: 'right' }}><Button type="primary" onClick={onClose}>Xong</Button></div>
  </>
}

/** Tạo mới hoặc sửa phiếu nháp; có thể lưu nháp hoặc lưu rồi xác nhận nhập kho ngay. */
export function LiveReceiptModal({ receipt, onClose }: { receipt?: PurchaseReceipt; onClose: () => void }) {
  const staff = useStaff()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [form] = Form.useForm<ReceiptDraft>()
  const [savedId, setSavedId] = useState(receipt?.id)
  const [confirmed, setConfirmed] = useState<PurchaseReceipt>()
  const discard = useConfirmDiscard(form, onClose)
  const products = useQuery({ queryKey: ['live', 'catalog'], queryFn: catalogApi.products })
  const suppliers = useQuery({ queryKey: ['live', 'receipt-suppliers', staff?.name, staff?.role], queryFn: catalogApi.suppliers })
  const lines: Partial<ReceiptLine>[] = Form.useWatch('lines', form) ?? []
  const receivedAt: string | undefined = Form.useWatch('receivedAt', form)
  const today = localToday()
  const total = lines.reduce((sum, line) => sum + (line?.quantityAccepted ?? 0) * (line?.unitCost ?? 0), 0)

  const save = useMutation({
    mutationFn: async ({ draft, confirm }: { draft: ReceiptDraft; confirm: boolean }) => {
      const input = toInput(draft)
      const saved = savedId === undefined ? await inventoryApi.createReceipt(input) : await inventoryApi.updateReceipt(savedId, input)
      setSavedId(saved.id)
      return confirm ? inventoryApi.confirmReceipt(saved.id) : saved
    },
    onSuccess: (result) => {
      void invalidateLiveData(queryClient)
      if (result.status === 'CONFIRMED') return setConfirmed(result)
      message.success(`Đã lưu nháp phiếu ${receiptCode(result)}.`)
      onClose()
    },
    onError: (error: Error) => {
      void invalidateLiveData(queryClient)
      message.error(savedId === undefined ? error.message : `Phiếu ${receiptCode({ id: savedId })} đã lưu nháp nhưng chưa nhập kho: ${error.message}`)
    },
  })
  const submit = (confirm: boolean) => form.validateFields().then((draft) => save.mutate({ draft, confirm }), () => undefined)

  const title = confirmed ? 'Kết quả nhập kho' : savedId !== undefined ? `Sửa phiếu nháp ${receiptCode({ id: savedId })}` : 'Tạo phiếu nhập hàng'
  const loading = products.isPending || suppliers.isPending
  return <Modal open title={title} width={920} onCancel={confirmed ? onClose : discard} footer={null} maskClosable={!save.isPending}>
    {confirmed ? <ReceiptResult receipt={confirmed} onClose={onClose} />
      : products.isError ? <QueryError error={products.error} onRetry={products.refetch} />
      : suppliers.isError ? <QueryError error={suppliers.error} onRetry={suppliers.refetch} />
      : <Form form={form} name="live-receipt" layout="vertical" scrollToFirstError={{ focus: true }} disabled={save.isPending} initialValues={receipt ? toDraft(receipt) : { receivedAt: today, lines: [newLine] }}>
        <Row gutter={16}>
          <Col xs={24} md={16}><Form.Item name="supplierId" label="Nhà cung cấp" rules={[{ required: true, message: 'Chọn nhà cung cấp.' }]}><Select loading={suppliers.isPending} showSearch={{ optionFilterProp: 'label' }} options={(suppliers.data ?? []).map((item) => ({ value: item.id, label: item.name }))} /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name="receivedAt" label="Ngày nhận" rules={[{ required: true, message: 'Chọn ngày nhận.' }, { validator: (_, value) => !value || value <= today ? Promise.resolve() : Promise.reject(new Error('Không chọn ngày tương lai.')) }]}><Input type="date" max={today} /></Form.Item></Col>
        </Row>
        <Form.List name="lines">{(fields, { add, remove }) => <>
          {fields.map((field, index) => <div className="af-receipt-line" key={field.key}>
            <div className="af-receipt-line-head"><strong>Dòng {index + 1}</strong><Button danger disabled={fields.length === 1} onClick={() => remove(field.name)}>Xóa dòng</Button></div>
            <Row gutter={12}>
              <Col xs={24} md={12}><Form.Item name={[field.name, 'productId']} label="Sản phẩm" rules={[{ required: true, message: 'Chọn sản phẩm.' }]}><Select loading={products.isPending} showSearch={{ optionFilterProp: 'label' }} options={(products.data ?? []).map((product) => ({ value: product.id, label: `${product.sku} · ${product.name}` }))} /></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name={[field.name, 'lotCode']} label="Mã lô" rules={[{ required: true, whitespace: true, message: 'Nhập mã lô.' }, { max: 100, message: 'Mã lô tối đa 100 ký tự.' }, { validator: (_, value: string | undefined) => !value || lines.filter((line, other) => other !== field.name && line?.productId === lines[field.name]?.productId && line?.lotCode?.trim() === value.trim()).length === 0 ? Promise.resolve() : Promise.reject(new Error('Lô này đã có ở dòng khác.')) }]}><Input /></Form.Item></Col>
              <Col xs={12} md={6}><Form.Item name={[field.name, 'manufacturedOn']} label="Ngày sản xuất" rules={[{ validator: (_, value) => !value || value <= today ? Promise.resolve() : Promise.reject(new Error('Không chọn ngày tương lai.')) }]}><Input type="date" max={today} /></Form.Item></Col>
              <Col xs={12} md={6}><Form.Item name={[field.name, 'expiresOn']} label="Hạn sử dụng" dependencies={[['lines', field.name, 'manufacturedOn'], 'receivedAt']} rules={[{ required: true, message: 'Chọn hạn sử dụng.' }, { validator: (_, value) => {
                const made = lines[field.name]?.manufacturedOn
                if (!value) return Promise.resolve()
                if (value <= today) return Promise.reject(new Error('Lô đã hết hạn hoặc hết hạn hôm nay.'))
                if (made && value <= made) return Promise.reject(new Error('Phải sau ngày sản xuất.'))
                if (receivedAt && value < receivedAt) return Promise.reject(new Error('Không trước ngày nhận.'))
                return Promise.resolve()
              } }]}><Input type="date" min={today} /></Form.Item></Col>
              <Col xs={8} md={4}><Form.Item name={[field.name, 'quantityReceived']} label="SL nhận" rules={[{ required: true, message: 'Nhập số lượng.' }, { type: 'integer', min: 1, message: 'Số nguyên dương.' }]}><InputNumber min={1} precision={0} style={{ width: '100%' }} onChange={(value) => {
                const accepted = form.getFieldValue(['lines', field.name, 'quantityAccepted'])
                if (typeof value === 'number' && (accepted === undefined || accepted === lines[field.name]?.quantityReceived || accepted > value)) form.setFieldValue(['lines', field.name, 'quantityAccepted'], value)
              }} /></Form.Item></Col>
              <Col xs={8} md={4}><Form.Item name={[field.name, 'quantityAccepted']} label="SL nhập kho" tooltip="Phần còn lại tính là hàng bị loại (hỏng, sai quy cách)." dependencies={[['lines', field.name, 'quantityReceived']]} rules={[{ required: true, message: 'Nhập số lượng.' }, { type: 'integer', min: 0, message: 'Không được âm.' }, { validator: (_, value) => value === undefined || value <= (lines[field.name]?.quantityReceived ?? Infinity) ? Promise.resolve() : Promise.reject(new Error('Không vượt SL nhận.')) }]}><InputNumber min={0} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
              <Col xs={8} md={4}><Form.Item name={[field.name, 'unitCost']} label="Giá nhập / đơn vị" rules={[{ required: true, message: 'Nhập giá.' }, { type: 'number', min: 0, message: 'Giá không được âm.' }]}><InputNumber min={0} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
            </Row>
          </div>)}
          <Button type="dashed" block onClick={() => add(newLine)}>Thêm dòng hàng</Button>
        </>}</Form.List>
        <Form.Item name="note" label="Ghi chú" rules={[{ max: 500 }]} style={{ marginTop: 16 }}><Input.TextArea rows={2} /></Form.Item>
        <div className="af-order-summary"><span>Giá trị nhập kho</span><strong>{currency(total)}</strong></div>
        <Alert type="info" showIcon style={{ marginTop: 12 }} title="Lưu nháp chưa cộng tồn kho. Sau khi xác nhận nhập kho, phiếu không sửa hoặc hủy được nữa." />
        <Space wrap style={{ marginTop: 16, width: '100%', justifyContent: 'flex-end' }}>
          <Button onClick={discard} disabled={save.isPending}>Đóng</Button>
          <Button disabled={loading} loading={save.isPending && !save.variables?.confirm} onClick={() => void submit(false)}>Lưu nháp</Button>
          <Button type="primary" disabled={loading} loading={save.isPending && save.variables?.confirm} onClick={() => void submit(true)}>Lưu và nhập kho</Button>
        </Space>
      </Form>}
  </Modal>
}
