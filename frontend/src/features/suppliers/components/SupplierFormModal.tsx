import { App, Col, Form, Input, Modal, Row } from 'antd'
import type { Supplier, SupplierDraft } from '../types'
import { useSaveSupplier } from '../useSuppliers'
import { useConfirmDiscard } from '@/shared/hooks/useConfirmDiscard'
import { useFeature } from '@/shared/features'
import { UNSUPPORTED_HINT } from '@/shared/components/Unsupported'

/** Thêm mới khi không có `supplier`; sửa khi có. */
export function SupplierFormModal({ supplier, onClose, onSaved }: { supplier?: Supplier; onClose: () => void; onSaved: () => void }) {
  const { message } = App.useApp()
  const [form] = Form.useForm<SupplierDraft>()
  const cancel = useConfirmDiscard(form, onClose)
  const save = useSaveSupplier()
  const showContact = useFeature('supplierContactName')
  const showEmail = useFeature('supplierEmail')

  const submit = (draft: SupplierDraft) => {
    if (save.isPending) return
    save.mutate({ id: supplier?.id, draft }, {
      onSuccess: (saved) => {
        message.success(supplier ? `Đã cập nhật nhà cung cấp ${saved.name}.` : `Đã thêm nhà cung cấp ${saved.name}.`)
        onSaved()
      },
      onError: (error) => message.error(error.message),
    })
  }

  return (
    <Modal
      open
      centered
      title={supplier ? `Sửa nhà cung cấp ${supplier.code}` : 'Thêm nhà cung cấp'}
      width={600}
      okText="Lưu nhà cung cấp"
      cancelText="Hủy"
      onOk={() => form.submit()}
      onCancel={() => { if (!save.isPending) cancel() }}
      confirmLoading={save.isPending}
      cancelButtonProps={{ disabled: save.isPending }}
      closable={!save.isPending}
      styles={{ body: { maxHeight: 'calc(100dvh - 200px)', overflowY: 'auto', paddingTop: 16 } }}
    >
      <Form<SupplierDraft> form={form} layout="vertical" onFinish={submit} disabled={save.isPending} initialValues={supplier && { name: supplier.name, contactName: supplier.contactName, phone: supplier.phone, email: supplier.email, address: supplier.address }}>
        <Form.Item name="name" label="Tên nhà cung cấp" rules={[{ required: true, whitespace: true, message: 'Nhập tên nhà cung cấp.' }, { max: 150, message: 'Tên tối đa 150 ký tự.' }]}>
          <Input autoFocus placeholder="Ví dụ: Công ty phân phối nước Minh An" maxLength={150} />
        </Form.Item>
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item name="contactName" label="Người liên hệ" extra={showContact ? undefined : UNSUPPORTED_HINT} rules={[{ max: 100, message: 'Tên người liên hệ tối đa 100 ký tự.' }]}>
              <Input placeholder="Họ và tên người liên hệ" maxLength={100} disabled={!showContact} />
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
        <Form.Item name="email" label="Email" extra={showEmail ? undefined : UNSUPPORTED_HINT} rules={[{ type: 'email', transform: (value: string) => value?.trim(), message: 'Email không đúng định dạng.' }, { max: 254, message: 'Email tối đa 254 ký tự.' }]}>
          <Input placeholder="Ví dụ: lienhe@congty.vn" maxLength={254} disabled={!showEmail} />
        </Form.Item>
        <Form.Item name="address" label="Địa chỉ" rules={[{ required: true, whitespace: true, message: 'Nhập địa chỉ nhà cung cấp.' }, { max: 300, message: 'Địa chỉ tối đa 300 ký tự.' }]}>
          <Input.TextArea rows={2} placeholder="Số nhà, đường, phường/xã, tỉnh/thành phố" maxLength={300} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
