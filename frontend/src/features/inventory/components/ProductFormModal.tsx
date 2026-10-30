import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { App, Col, Form, Input, InputNumber, Modal, Row, Select, Upload } from 'antd'
import { ImagePlus } from 'lucide-react'
import { useFeature, useIsDemo } from '../../../shared/features'
import { UNSUPPORTED_HINT } from '../../../shared/components/Unsupported'
import { bottleTypeApi } from '../../live/bottleTypeApi'
import { useSaveProduct, type CatalogItem, type ProductForm } from '../productCatalog'
import { useConfirmDiscard } from '../../../shared/hooks/useConfirmDiscard'

const MAX_IMAGE_MB = 5
const UNITS = ['Bình', 'Thùng', 'Chai', 'Vỏ']

type ProductFormModalProps = { open: boolean; product?: CatalogItem; onClose: () => void }

/** Thêm mới khi không có `product`; sửa khi có (mã sản phẩm không đổi). */
export function ProductFormModal({ open, product, onClose }: ProductFormModalProps) {
  const { message } = App.useApp()
  const demo = useIsDemo()
  const showImage = useFeature('productImage')
  const [form] = Form.useForm<ProductForm>()
  const [image, setImage] = useState<string | undefined>(product?.image)
  const save = useSaveProduct()
  // Loại vỏ và quy cách thùng chỉ có ở BE; tồn ban đầu chỉ ở bản dùng thử (BE tăng tồn qua phiếu nhập).
  const bottleTypes = useQuery({ queryKey: ['live', 'bottle-types', 'product-form'], queryFn: () => bottleTypeApi.list(), enabled: open && !demo })

  const close = () => {
    setImage(undefined)
    onClose()
  }
  const cancel = useConfirmDiscard(form, close)

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

  const submit = (values: ProductForm) =>
    save.mutate(
      { id: product?.id, form: { ...values, image } },
      {
        onSuccess: (saved) => {
          message.success(product ? `Đã cập nhật sản phẩm ${saved.name}.` : `Đã thêm sản phẩm ${saved.name}.`)
          close()
        },
        onError: (error) => message.error(error.message),
      },
    )

  const units = product && !UNITS.includes(product.unit) ? [...UNITS, product.unit] : UNITS

  return (
    <Modal
      open={open}
      title={product ? `Sửa sản phẩm ${product.sku}` : 'Thêm sản phẩm'}
      okText="Lưu sản phẩm"
      cancelText="Hủy"
      width={560}
      confirmLoading={save.isPending}
      onOk={() => form.submit()}
      onCancel={cancel}
      destroyOnHidden
    >
      <Form<ProductForm>
        form={form}
        layout="vertical"
        disabled={save.isPending}
        initialValues={product
          ? { sku: product.sku, name: product.name, brand: product.brand === 'Chưa có thương hiệu' ? undefined : product.brand, unit: product.unit, price: product.price, unitsPerCase: product.unitsPerCase, bottleTypeId: product.bottleTypeId }
          : { unit: 'Bình', price: 0, stock: 0 }}
        onFinish={submit}
        preserve={false}
      >
        <Form.Item label="Ảnh sản phẩm" extra={showImage ? `PNG, JPG hoặc WEBP, tối đa ${MAX_IMAGE_MB} MB.` : UNSUPPORTED_HINT}>
            <Upload accept="image/*" listType="picture-card" maxCount={1} showUploadList={false} beforeUpload={readImage} disabled={!showImage}>
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
            <Form.Item name="name" label="Tên sản phẩm" rules={[{ required: true, whitespace: true, message: 'Nhập tên sản phẩm.' }, { max: 200, message: 'Tên tối đa 200 ký tự.' }]}>
              <Input autoFocus placeholder="Ví dụ: Nước tinh khiết bình 20L" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={10}>
            <Form.Item
              name="sku"
              label="Mã sản phẩm"
              extra={product ? 'Mã sản phẩm không đổi sau khi tạo.' : undefined}
              rules={[
                { required: true, whitespace: true, message: 'Nhập mã sản phẩm.' },
                { pattern: /^[A-Za-z0-9-]+$/, message: 'Chỉ dùng chữ, số và dấu gạch ngang.' },
                { max: 64, message: 'Mã tối đa 64 ký tự.' },
              ]}
            >
              <Input placeholder="Ví dụ: LAVIE-19L" disabled={Boolean(product)} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={14}>
            <Form.Item name="brand" label="Thương hiệu" rules={[{ max: 150, message: 'Tối đa 150 ký tự.' }]}>
              <Input placeholder="Ví dụ: LaVie, Aquafina..." />
            </Form.Item>
          </Col>
          <Col xs={24} sm={10}>
            <Form.Item name="unit" label="Đơn vị" rules={[{ required: true }]}>
              <Select options={units.map((unit) => ({ value: unit, label: unit }))} />
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
          {demo && !product && (
            <Col xs={24} sm={10}>
              <Form.Item name="stock" label="Tồn kho ban đầu" rules={[{ required: true, message: 'Nhập số lượng.' }]}>
                <InputNumber min={0} precision={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          )}
          {!demo && (
            <>
              <Col xs={24} sm={10}>
                <Form.Item name="unitsPerCase" label="Số đơn vị / thùng">
                  <InputNumber min={1} precision={0} style={{ width: '100%' }} placeholder="Không bắt buộc" />
                </Form.Item>
              </Col>
              <Col xs={24}>
                <Form.Item name="bottleTypeId" label="Loại vỏ" extra="Chọn khi sản phẩm bán kèm vỏ bình có cọc.">
                  <Select
                    allowClear
                    loading={bottleTypes.isPending}
                    placeholder="Không dùng vỏ"
                    options={(bottleTypes.data ?? []).filter((type) => type.active || type.id === product?.bottleTypeId).map((type) => ({ value: type.id, label: `${type.name}${type.active ? '' : ' (đã ngừng dùng)'}`, disabled: !type.active }))}
                  />
                </Form.Item>
              </Col>
            </>
          )}
        </Row>
        {!demo && !product && <p className="af-form-hint">Tồn kho tăng khi xác nhận phiếu nhập ở trang Kho.</p>}
      </Form>
    </Modal>
  )
}
