import { useState } from 'react'
import { App, Col, Form, Input, InputNumber, Modal, Row, Select, Upload } from 'antd'
import { ImagePlus } from 'lucide-react'
import type { ProductDraft } from '../types'
import { useCreateProduct } from '../useProducts'

const MAX_IMAGE_MB = 5

type ProductFormModalProps = { open: boolean; onClose: () => void }

export function ProductFormModal({ open, onClose }: ProductFormModalProps) {
  const { message } = App.useApp()
  const [form] = Form.useForm<ProductDraft>()
  const [image, setImage] = useState<string>()
  const createProduct = useCreateProduct()

  const close = () => {
    setImage(undefined)
    onClose()
  }

  // Đọc ảnh thành data URL để xem trước; trả về false để Upload không tự gửi lên server.
  const readImage = (file: File) => {
    if (!file.type.startsWith('image/')) {
      message.error('Vui lòng chọn một tệp hình ảnh (PNG, JPG, WEBP).')
      return Upload.LIST_IGNORE
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      message.error(`Ảnh cần nhỏ hơn ${MAX_IMAGE_MB} MB.`)
      return Upload.LIST_IGNORE
    }
    const reader = new FileReader()
    reader.onload = () => setImage(typeof reader.result === 'string' ? reader.result : undefined)
    reader.readAsDataURL(file)
    return false
  }

  const submit = (values: ProductDraft) =>
    createProduct.mutate(
      { ...values, image },
      {
        onSuccess: (product) => {
          message.success(`Đã thêm sản phẩm ${product.name}.`)
          close()
        },
        onError: (error) => message.error(error.message),
      },
    )

  return (
    <Modal
      open={open}
      title="Thêm sản phẩm"
      okText="Lưu sản phẩm"
      cancelText="Hủy"
      width={560}
      confirmLoading={createProduct.isPending}
      onOk={() => form.submit()}
      onCancel={close}
      destroyOnHidden
    >
      <Form<ProductDraft> form={form} layout="vertical" initialValues={{ unit: 'Bình', price: 0, stock: 0 }} onFinish={submit} preserve={false}>
        <Form.Item label="Ảnh sản phẩm" extra={`PNG, JPG hoặc WEBP, tối đa ${MAX_IMAGE_MB} MB.`}>
          <Upload accept="image/*" listType="picture-card" maxCount={1} showUploadList={false} beforeUpload={readImage}>
            {image ? (
              <img src={image} alt="Ảnh xem trước" className="af-upload-preview" />
            ) : (
              <span className="af-upload-empty">
                <ImagePlus size={20} />
                Chọn ảnh
              </span>
            )}
          </Upload>
        </Form.Item>
        <Row gutter={16}>
          <Col xs={24} sm={14}>
            <Form.Item name="name" label="Tên sản phẩm" rules={[{ required: true, whitespace: true, message: 'Nhập tên sản phẩm.' }]}>
              <Input autoFocus placeholder="Ví dụ: Nước tinh khiết bình 20L" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={10}>
            <Form.Item
              name="sku"
              label="Mã sản phẩm"
              rules={[
                { required: true, whitespace: true, message: 'Nhập mã sản phẩm.' },
                { pattern: /^[A-Za-z0-9-]+$/, message: 'Chỉ dùng chữ, số và dấu gạch ngang.' },
              ]}
            >
              <Input placeholder="Ví dụ: LAVIE-19L" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={14}>
            <Form.Item name="brand" label="Thương hiệu">
              <Input placeholder="Ví dụ: LaVie, Aquafina..." />
            </Form.Item>
          </Col>
          <Col xs={24} sm={10}>
            <Form.Item name="unit" label="Đơn vị" rules={[{ required: true }]}>
              <Select options={['Bình', 'Thùng', 'Chai', 'Vỏ'].map((unit) => ({ value: unit, label: unit }))} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={14}>
            <Form.Item name="price" label="Giá bán (₫)" rules={[{ required: true, message: 'Nhập giá bán.' }]}>
              <InputNumber<number>
                min={0}
                step={1000}
                style={{ width: '100%' }}
                formatter={(value) => `${value ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                parser={(value) => Number((value ?? '').replace(/\./g, ''))}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={10}>
            <Form.Item name="stock" label="Tồn kho ban đầu" rules={[{ required: true, message: 'Nhập số lượng.' }]}>
              <InputNumber min={0} precision={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  )
}
