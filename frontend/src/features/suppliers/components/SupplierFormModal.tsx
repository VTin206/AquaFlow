import { App, Col, Form, Input, Modal, Row } from 'antd'
import type { SupplierDraft } from '../types'
import { useCreateSupplier } from '../useSuppliers'

export function SupplierFormModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { message } = App.useApp()
  const [form] = Form.useForm<SupplierDraft>()
  const createSupplier = useCreateSupplier()

  const submit = (draft: SupplierDraft) => {
    if (createSupplier.isPending) return
    createSupplier.mutate(draft, {
      onSuccess: (supplier) => {
        message.success(`Đã thêm nhà cung cấp ${supplier.name}.`)
        onCreated()
      },
      onError: (error) => message.error(error.message),
    })
  }

  return (
    <Modal
      open
      centered
      title="Thêm nhà cung cấp"
      width={600}
      okText="Lưu nhà cung cấp"
      cancelText="Hủy"
      onOk={() => form.submit()}
      onCancel={() => { if (!createSupplier.isPending) onClose() }}
      confirmLoading={createSupplier.isPending}
      cancelButtonProps={{ disabled: createSupplier.isPending }}
      closable={!createSupplier.isPending}
      styles={{ body: { maxHeight: 'calc(100dvh - 200px)', overflowY: 'auto', paddingTop: 16 } }}
    >
      <Form<SupplierDraft> form={form} layout="vertical" onFinish={submit} disabled={createSupplier.isPending}>
        <Form.Item name="name" label="Tên nhà cung cấp" rules={[{ required: true, whitespace: true, message: 'Nhập tên nhà cung cấp.' }, { max: 150, message: 'Tên tối đa 150 ký tự.' }]}>
          <Input autoFocus placeholder="Ví dụ: Công ty phân phối nước Minh An" maxLength={150} />
        </Form.Item>
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item name="contactName" label="Người liên hệ" rules={[{ max: 100, message: 'Tên người liên hệ tối đa 100 ký tự.' }]}>
              <Input placeholder="Họ và tên người liên hệ" maxLength={100} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="phone" label="Số điện thoại" rules={[
              { required: true, whitespace: true, message: 'Nhập số điện thoại.' },
              { transform: (value: string) => value?.replace(/[\s().-]/g, ''), pattern: /^(?:0\d{9,10}|\+84\d{9,10})$/, message: 'Nhập số điện thoại hợp lệ, bắt đầu bằng 0 hoặc +84.' },
            ]}>
              <Input type="tel" placeholder="Ví dụ: 0901 234 567" maxLength={20} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="email" label="Email" rules={[{ type: 'email', transform: (value: string) => value?.trim(), message: 'Email không đúng định dạng.' }, { max: 254, message: 'Email tối đa 254 ký tự.' }]}>
          <Input placeholder="Ví dụ: lienhe@congty.vn" maxLength={254} />
        </Form.Item>
        <Form.Item name="address" label="Địa chỉ" rules={[{ required: true, whitespace: true, message: 'Nhập địa chỉ nhà cung cấp.' }, { max: 300, message: 'Địa chỉ tối đa 300 ký tự.' }]}>
          <Input.TextArea rows={2} placeholder="Số nhà, đường, phường/xã, tỉnh/thành phố" maxLength={300} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
