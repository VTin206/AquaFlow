import { App, Button, Col, Form, Input, InputNumber, Modal, Row, Select, Typography } from 'antd'
import { Plus, Trash2 } from 'lucide-react'
import { currency } from '../../../shared/utils/format'
import { useSuppliers } from '../../suppliers/useSuppliers'
import { localToday } from '../expiry'
import { tracksExpiry, type ReceiptDraft } from '../types'
import { useCreateReceipt, useProducts } from '../useProducts'
import { useConfirmDiscard } from '../../../shared/hooks/useConfirmDiscard'

type ReceiveStockModalProps = { open: boolean; onClose: () => void; defaultProductId?: string }

/** Phiếu nhập kiểm nhận: nhiều dòng, mỗi dòng là một lô có hạn dùng, số hỏng và giá vốn. */
export function ReceiveStockModal(props: ReceiveStockModalProps) {
  return props.open ? <ReceiptDialog {...props} /> : null
}

function ReceiptDialog({ open, onClose, defaultProductId }: ReceiveStockModalProps) {
  const { message } = App.useApp()
  const [form] = Form.useForm<ReceiptDraft>()
  const cancel = useConfirmDiscard(form, onClose)
  const { data: products = [], isPending: loadingProducts } = useProducts()
  const { data: suppliers = [], isPending: loadingSuppliers } = useSuppliers()
  const createReceipt = useCreateReceipt()
  const lines: Partial<ReceiptDraft['lines'][number]>[] = Form.useWatch('lines', form) ?? []
  const receivedAt: string | undefined = Form.useWatch('receivedAt', form)
  const today = localToday()
  const productOf = (id?: string) => products.find((product) => product.id === id)
  const good = lines.reduce((sum, line) => sum + Math.max(0, (line?.received ?? 0) - (line?.damaged ?? 0)), 0)
  const total = lines.reduce((sum, line) => sum + Math.max(0, (line?.received ?? 0) - (line?.damaged ?? 0)) * (line?.costPrice ?? 0), 0)

  return (
    <Modal
      open={open}
      title="Tạo phiếu nhập kho"
      width={880}
      style={{ top: 24 }}
      styles={{ body: { maxHeight: 'calc(100dvh - 200px)', overflowY: 'auto', paddingRight: 8 } }}
      okText="Xác nhận nhập kho"
      cancelText="Hủy"
      confirmLoading={createReceipt.isPending}
      onOk={() => form.submit()}
      onCancel={cancel}
      destroyOnHidden
    >
      <Form<ReceiptDraft>
        name="receive-stock"
        form={form}
        layout="vertical"
        scrollToFirstError={{ block: 'center', focus: true }}
        initialValues={{
          receivedAt: today,
          receiver: 'Nguyễn An',
          lines: [{ productId: defaultProductId, received: 1, damaged: 0, costPrice: 0 }],
        }}
        onFinish={(draft) =>
          createReceipt.mutate(draft, {
            onSuccess: (receipt) => {
              message.success(`Đã nhập kho phiếu ${receipt.id} (${good} đơn vị đạt).`)
              onClose()
            },
            onError: (error) => message.error(error.message),
          })
        }
      >
        <div className="af-form-section-title">1. Thông tin kiểm nhận</div>
        <Row gutter={16}>
          <Col xs={24} md={10}>
            <Form.Item name="supplierId" label="Nhà cung cấp" rules={[{ required: true, message: 'Chọn nhà cung cấp.' }]}>
              <Select
                loading={loadingSuppliers}
                showSearch={{ optionFilterProp: 'label' }}
                placeholder="Chọn nhà cung cấp"
                options={suppliers.map((supplier) => ({ value: supplier.id, label: `${supplier.name} (${supplier.id})` }))}
              />
            </Form.Item>
          </Col>
          <Col xs={12} md={6}>
            <Form.Item
              name="receivedAt"
              label="Ngày nhận"
              rules={[{ required: true, message: 'Chọn ngày nhận.' }, { validator: (_, value) => (!value || value <= today ? Promise.resolve() : Promise.reject(new Error('Không chọn ngày tương lai.'))) }]}
            >
              <Input type="date" max={today} />
            </Form.Item>
          </Col>
          <Col xs={12} md={8}>
            <Form.Item name="receiver" label="Người kiểm nhận" rules={[{ required: true, whitespace: true, message: 'Nhập người kiểm nhận.' }]}>
              <Input />
            </Form.Item>
          </Col>
        </Row>

        <div className="af-form-section-title">2. Hàng nhận theo lô</div>
        <Form.List name="lines" rules={[{ validator: (_, value) => (value?.length ? Promise.resolve() : Promise.reject(new Error('Thêm ít nhất một dòng hàng.'))) }]}>
          {(fields, { add, remove }, { errors }) => (
            <>
              {fields.map((field, index) => {
                const line = lines[field.name]
                const product = productOf(line?.productId)
                const needsLot = !product || tracksExpiry(product)
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
                            loading={loadingProducts}
                            showSearch={{ optionFilterProp: 'label' }}
                            placeholder="Chọn sản phẩm"
                            options={products.map((item) => ({ value: item.id, label: `${item.name} (${item.sku}) · tồn ${item.stock}` }))}
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item name={[field.name, 'lotCode']} label="Mã lô" rules={[{ required: needsLot, whitespace: true, message: 'Nhập mã lô in trên bao bì.' }, { max: 40 }]}>
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
                        Đạt {Math.max(0, (line?.received ?? 0) - (line?.damaged ?? 0))} {product.unit.toLowerCase()} → tồn bán được {product.stock} → <strong>{product.stock + Math.max(0, (line?.received ?? 0) - (line?.damaged ?? 0))}</strong>
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
        </Typography.Paragraph>
      </Form>
    </Modal>
  )
}
