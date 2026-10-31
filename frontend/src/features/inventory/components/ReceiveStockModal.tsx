import { useState } from 'react'
import { App, Button, Col, Form, Input, InputNumber, Modal, Result, Row, Select, Space, Table, Typography } from 'antd'
import { Plus, Trash2 } from 'lucide-react'
import { QueryError } from '@/shared/components/QueryError'
import { currency } from '@/shared/utils/format'
import { isoToVnDate, localToday } from '../expiry'
import { tracksExpiry } from '../types'
import { receiptToForm, useInventoryCaps, useReceiptOptions, useSaveReceipt, type ReceiptForm, type ReceiptLineView, type ReceiptView } from '../inventoryData'
import { useConfirmDiscard } from '@/shared/hooks/useConfirmDiscard'

type ReceiveStockModalProps = { open: boolean; onClose: () => void; defaultProductId?: string; receipt?: ReceiptView }

/** Phiếu nhập kiểm nhận: nhiều dòng, mỗi dòng là một lô có hạn dùng, số hỏng và giá vốn. */
export function ReceiveStockModal(props: ReceiveStockModalProps) {
  return props.open ? <ReceiptDialog {...props} /> : null
}

/** Kết quả nhập kho: số lượng từng lô đã cộng vào tồn bán được. */
export function ReceiptResult({ receipt, onClose }: { receipt: ReceiptView; onClose: () => void }) {
  const good = receipt.lines.reduce((sum, line) => sum + line.received - line.damaged, 0)
  const damaged = receipt.lines.reduce((sum, line) => sum + line.damaged, 0)
  return (
    <>
      <Result status="success" title={`Đã nhập kho phiếu ${receipt.code}`} subTitle={`${receipt.supplierName} · cộng ${good} đơn vị vào tồn bán được${damaged ? `, ${damaged} hỏng không nhập` : ''}.`} style={{ paddingBlock: 16 }} />
      <Table<ReceiptLineView>
        rowKey={(line) => `${line.productId}-${line.lotCode}`}
        size="small"
        pagination={false}
        dataSource={receipt.lines}
        scroll={{ x: 640 }}
        columns={[
          { title: 'Sản phẩm', dataIndex: 'productName', ellipsis: true },
          { title: 'Mã lô', dataIndex: 'lotCode', width: 130, render: (code?: string) => code ?? '—' },
          { title: 'Hạn dùng', dataIndex: 'expiryDate', width: 110, render: (date?: string) => (date ? isoToVnDate(date) : '—') },
          { title: 'Nhập kho', key: 'good', width: 90, align: 'right', render: (_, line) => <strong>{line.received - line.damaged}</strong> },
          { title: 'Hỏng', dataIndex: 'damaged', width: 70, align: 'right', render: (value: number) => (value ? <Typography.Text type="danger">{value}</Typography.Text> : 0) },
          { title: 'Thành tiền', key: 'total', width: 130, align: 'right', render: (_, line) => currency((line.received - line.damaged) * line.costPrice) },
        ]}
      />
      <div className="af-order-summary" style={{ marginTop: 12 }}>
        <span>Giá trị hàng đạt</span>
        <strong>{currency(receipt.total)}</strong>
      </div>
      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <Button type="primary" onClick={onClose}>Xong</Button>
      </div>
    </>
  )
}

function ReceiptDialog({ open, onClose, defaultProductId, receipt }: ReceiveStockModalProps) {
  const { message } = App.useApp()
  const caps = useInventoryCaps()
  const [form] = Form.useForm<ReceiptForm>()
  const discard = useConfirmDiscard(form, onClose)
  const options = useReceiptOptions()
  const save = useSaveReceipt()
  const [savedId, setSavedId] = useState(receipt?.id)
  const [result, setResult] = useState<ReceiptView>()
  const lines: Partial<ReceiptForm['lines'][number]>[] = Form.useWatch('lines', form) ?? []
  const receivedAt: string | undefined = Form.useWatch('receivedAt', form)
  const today = localToday()
  const productOf = (id?: string) => options.products.find((product) => product.id === id)
  const good = lines.reduce((sum, line) => sum + Math.max(0, (line?.received ?? 0) - (line?.damaged ?? 0)), 0)
  const total = lines.reduce((sum, line) => sum + Math.max(0, (line?.received ?? 0) - (line?.damaged ?? 0)) * (line?.costPrice ?? 0), 0)

  const submit = (confirm: boolean) =>
    form.validateFields().then(
      (values) =>
        save.mutate(
          { id: savedId, form: values, confirm, onSaved: setSavedId },
          {
            onSuccess: (saved) => {
              if (saved.status === 'CONFIRMED') return setResult(saved)
              message.success(`Đã lưu nháp phiếu ${saved.code}. Tồn kho chưa thay đổi.`)
              onClose()
            },
            onError: (error) => message.error(savedId === undefined || !caps.drafts ? error.message : `Phiếu đã lưu nháp nhưng chưa nhập kho: ${error.message}`),
          },
        ),
      () => undefined,
    )

  const title = result ? 'Kết quả nhập kho' : savedId !== undefined ? 'Sửa phiếu nhập nháp' : 'Tạo phiếu nhập kho'
  const footer = result ? null : (
    <Space wrap>
      <Button onClick={discard} disabled={save.isPending}>Hủy</Button>
      {caps.drafts && <Button loading={save.isPending && !save.variables?.confirm} disabled={save.isPending} onClick={() => void submit(false)}>Lưu nháp</Button>}
      <Button type="primary" loading={save.isPending && save.variables?.confirm} disabled={save.isPending} onClick={() => void submit(true)}>Xác nhận nhập kho</Button>
    </Space>
  )

  return (
    <Modal
      open={open}
      title={title}
      width={880}
      styles={{ body: { maxHeight: 'calc(100dvh - 200px)', overflowY: 'auto', paddingRight: 8 } }}
      footer={footer}
      onCancel={result ? onClose : discard}
      maskClosable={!save.isPending}
      destroyOnHidden
    >
      {result ? <ReceiptResult receipt={result} onClose={onClose} /> : options.error ? <QueryError error={options.error} onRetry={options.retry} /> : (
        <Form<ReceiptForm>
          name="receive-stock"
          form={form}
          layout="vertical"
          disabled={save.isPending}
          scrollToFirstError={{ block: 'center', focus: true }}
          initialValues={receipt ? receiptToForm(receipt) : {
            receivedAt: today,
            receiver: caps.receiver ? 'Nguyễn An' : undefined,
            lines: [{ productId: defaultProductId, received: 1, damaged: 0, costPrice: 0 }],
          }}
        >
          <div className="af-form-section-title">1. Thông tin kiểm nhận</div>
          <Row gutter={16}>
            <Col xs={24} md={caps.receiver ? 10 : 16}>
              <Form.Item name="supplierId" label="Nhà cung cấp" rules={[{ required: true, message: 'Chọn nhà cung cấp.' }]}>
                <Select
                  loading={options.loadingSuppliers}
                  showSearch={{ optionFilterProp: 'label' }}
                  placeholder="Chọn nhà cung cấp"
                  options={options.suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name }))}
                />
              </Form.Item>
            </Col>
            <Col xs={12} md={caps.receiver ? 6 : 8}>
              <Form.Item
                name="receivedAt"
                label="Ngày nhận"
                rules={[{ required: true, message: 'Chọn ngày nhận.' }, { validator: (_, value) => (!value || value <= today ? Promise.resolve() : Promise.reject(new Error('Không chọn ngày tương lai.'))) }]}
              >
                <Input type="date" max={today} />
              </Form.Item>
            </Col>
            {caps.receiver && (
              <Col xs={12} md={8}>
                <Form.Item name="receiver" label="Người kiểm nhận" rules={[{ required: true, whitespace: true, message: 'Nhập người kiểm nhận.' }]}>
                  <Input />
                </Form.Item>
              </Col>
            )}
          </Row>

          <div className="af-form-section-title">2. Hàng nhận theo lô</div>
          <Form.List name="lines" rules={[{ validator: (_, value) => (value?.length ? Promise.resolve() : Promise.reject(new Error('Thêm ít nhất một dòng hàng.'))) }]}>
            {(fields, { add, remove }, { errors }) => (
              <>
                {fields.map((field, index) => {
                  const line = lines[field.name]
                  const product = productOf(line?.productId)
                  const needsLot = caps.lotAlwaysRequired || !product?.unit || tracksExpiry({ unit: product.unit })
                  return (
                    <div className="af-receipt-line" key={field.key}>
                      <div className="af-receipt-line-head">
                        <strong>Dòng {index + 1}</strong>
                        <Button type="text" danger size="small" icon={<Trash2 size={15} />} aria-label={`Xóa dòng ${index + 1}`} disabled={fields.length === 1} onClick={() => remove(field.name)} />
                      </div>
                      <Row gutter={12}>
                        <Col xs={24} md={12}>
                          <Form.Item name={[field.name, 'productId']} label="Sản phẩm" rules={[{ required: true, message: 'Chọn sản phẩm.' }]}>
                            <Select
                              loading={options.loadingProducts}
                              showSearch={{ optionFilterProp: 'label' }}
                              placeholder="Chọn sản phẩm"
                              options={options.products.map((item) => ({ value: item.id, label: `${item.name} (${item.sku}) · tồn ${item.onHand}` }))}
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item
                            name={[field.name, 'lotCode']}
                            label="Mã lô"
                            rules={[
                              { required: needsLot, whitespace: true, message: 'Nhập mã lô in trên bao bì.' },
                              { max: caps.lotAlwaysRequired ? 100 : 40 },
                              {
                                validator: (_, value?: string) =>
                                  !value || !lines.some((other, at) => at !== field.name && other?.productId === line?.productId && other?.lotCode?.trim().toLowerCase() === value.trim().toLowerCase())
                                    ? Promise.resolve()
                                    : Promise.reject(new Error('Lô này đã có ở dòng khác.')),
                              },
                            ]}
                          >
                            <Input placeholder={needsLot ? 'Ví dụ: LV2610-19L' : 'Không bắt buộc với vỏ bình'} />
                          </Form.Item>
                        </Col>
                        {needsLot && (
                          <>
                            <Col xs={12} md={6}>
                              <Form.Item
                                name={[field.name, 'mfgDate']}
                                label="Ngày sản xuất"
                                rules={[{ validator: (_, value) => (!value || !receivedAt || value <= receivedAt ? Promise.resolve() : Promise.reject(new Error('Sau ngày nhận.'))) }]}
                              >
                                <Input type="date" max={receivedAt} />
                              </Form.Item>
                            </Col>
                            <Col xs={12} md={6}>
                              <Form.Item
                                name={[field.name, 'expiryDate']}
                                label="Hạn sử dụng"
                                dependencies={[['lines', field.name, 'mfgDate']]}
                                rules={[
                                  { required: true, message: 'Nhập hạn dùng.' },
                                  { validator: (_, value) => (!value || value > today ? Promise.resolve() : Promise.reject(new Error('Lô đã hết hạn.'))) },
                                  {
                                    validator: (_, value) =>
                                      !value || !line?.mfgDate || value > line.mfgDate ? Promise.resolve() : Promise.reject(new Error('Phải sau ngày sản xuất.')),
                                  },
                                ]}
                              >
                                <Input type="date" min={today} />
                              </Form.Item>
                            </Col>
                          </>
                        )}
                        <Col xs={8} md={4}>
                          <Form.Item name={[field.name, 'received']} label="Thực nhận" rules={[{ required: true, message: 'Nhập số.' }, { type: 'integer', min: 1, message: '≥ 1' }]}>
                            <InputNumber min={1} precision={0} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col xs={8} md={3}>
                          <Form.Item
                            name={[field.name, 'damaged']}
                            label="Hỏng"
                            dependencies={[['lines', field.name, 'received']]}
                            rules={[
                              { type: 'integer', min: 0, message: '≥ 0' },
                              { validator: (_, value) => ((value ?? 0) <= (line?.received ?? 0) ? Promise.resolve() : Promise.reject(new Error('Vượt số nhận.'))) },
                            ]}
                          >
                            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col xs={8} md={needsLot ? 5 : 17}>
                          <Form.Item name={[field.name, 'costPrice']} label="Giá vốn / đơn vị" rules={[{ required: true, message: 'Nhập giá.' }, { type: 'integer', min: 0 }]}>
                            <InputNumber<number> min={0} step={1000} precision={0} style={{ width: '100%' }} formatter={(value) => `${value ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} parser={(value) => Number(value?.replace(/\./g, '') ?? 0)} />
                          </Form.Item>
                        </Col>
                      </Row>
                      {product && (
                        <small className="af-receipt-line-hint">
                          Đạt {Math.max(0, (line?.received ?? 0) - (line?.damaged ?? 0))} {product.unit?.toLowerCase() ?? 'đơn vị'} → tồn {product.onHand} → <strong>{product.onHand + Math.max(0, (line?.received ?? 0) - (line?.damaged ?? 0))}</strong>
                          {caps.drafts && ' sau khi nhập kho'}
                        </small>
                      )}
                    </div>
                  )
                })}
                <Form.ErrorList errors={errors} />
                <Button type="dashed" block icon={<Plus size={16} />} onClick={() => add({ received: 1, damaged: 0, costPrice: 0 })}>
                  Thêm dòng hàng
                </Button>
              </>
            )}
          </Form.List>

          <div className="af-form-section-title">3. Ghi chú & tổng</div>
          <Form.Item name="note" label="Ghi chú kiểm nhận" rules={[{ max: 500 }]}>
            <Input.TextArea rows={2} placeholder="Thiếu so với hóa đơn, bao bì móp, nhiệt độ xe..." />
          </Form.Item>
          <div className="af-order-summary">
            <span>Giá trị hàng đạt ({good} đơn vị)</span>
            <strong>{currency(total)}</strong>
          </div>
          <Typography.Paragraph type="secondary" className="af-form-hint">
            Chỉ hàng đạt mới cộng vào tồn bán được. Hàng hỏng, thiếu hoặc lô đã hết hạn được ghi trên phiếu để đối soát với nhà cung cấp.
            {caps.drafts && ' Lưu nháp chưa cộng tồn; sau khi xác nhận nhập kho, phiếu không sửa hoặc hủy được nữa.'}
          </Typography.Paragraph>
        </Form>
      )}
    </Modal>
  )
}
