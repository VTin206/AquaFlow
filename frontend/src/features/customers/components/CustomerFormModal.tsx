import { App, Col, Form, Input, Modal, Row, Segmented } from 'antd'
import type { Customer, CustomerDraft } from '../types'
import { useSaveCustomer } from '../useCustomers'
import { useConfirmDiscard } from '@/shared/hooks/useConfirmDiscard'
import { useFeature } from '@/shared/features'
import { UNSUPPORTED_HINT } from '@/shared/components/Unsupported'
import { modalWidth } from '@/shared/utils/modal'
import { WardSelect } from '@/shared/address/WardSelect'
import { TextArea } from '@/shared/components/TextArea'

type CustomerFormModalProps = { open: boolean; customer?: Customer; onClose: () => void; onSaved?: (customer: Customer) => void }

export function CustomerFormModal({ open, customer, onClose, onSaved }: CustomerFormModalProps) {
  const { message } = App.useApp()
  const [form] = Form.useForm<CustomerDraft>()
  const cancel = useConfirmDiscard(form, onClose)
  const save = useSaveCustomer()
  const showType = useFeature('customerType')
  const showExtras = useFeature('customerProfileExtras')

  return (
    <Modal
      open={open}
      title={customer ? `Sửa hồ sơ ${customer.name}` : 'Thêm khách hàng'}
      okText={customer ? 'Lưu thay đổi' : 'Thêm khách hàng'}
      cancelText="Hủy"
      width={modalWidth.small}
      confirmLoading={save.isPending}
      onOk={() => form.submit()}
      onCancel={cancel}
      destroyOnHidden
    >
      <Form<CustomerDraft>
        form={form}
        layout="vertical"
        initialValues={
          customer
            ? {
                name: customer.name,
                phone: customer.phone,
                type: customer.type,
                area: customer.area,
                note: customer.note,
              }
            : { type: 'Cá nhân' }
        }
        onFinish={(draft) =>
          save.mutate(
            // Địa chỉ giao (người nhận, khu vực, mặc định) quản lý trong hồ sơ khách; form này giữ nguyên.
            { id: customer?.id, draft: { ...draft, addresses: customer?.addresses ?? [] } },
            {
              onSuccess: (saved) => {
                message.success(customer ? 'Đã cập nhật hồ sơ khách hàng.' : `Đã thêm khách hàng ${saved.name}.`)
                onClose()
                onSaved?.(saved)
              },
              onError: (error) => message.error(error.message),
            },
          )
        }
      >
        <Form.Item name="type" label="Loại khách" extra={showType ? undefined : UNSUPPORTED_HINT}>
          <Segmented options={['Cá nhân', 'Doanh nghiệp']} disabled={!showType} />
        </Form.Item>
        <Row gutter={16}>
          <Col xs={24} sm={14}>
            <Form.Item
              name="name"
              label="Tên khách hàng"
              rules={[{ required: true, whitespace: true, message: 'Nhập tên khách hàng.' }, { max: 100 }]}
            >
              <Input placeholder="Ví dụ: Nguyễn Văn An, Công ty Minh Khôi" autoFocus />
            </Form.Item>
          </Col>
          <Col xs={24} sm={10}>
            <Form.Item
              name="phone"
              label="Số điện thoại"
              rules={[
                { required: true, message: 'Nhập số điện thoại.' },
                {
                  validator: (_, value?: string) =>
                    !value || /^(?:0\d{9,10}|\+84\d{9,10})$/.test(value.replace(/[\s().-]/g, ''))
                      ? Promise.resolve()
                      : Promise.reject(new Error('Số điện thoại không hợp lệ.')),
                },
              ]}
            >
              <Input inputMode="tel" placeholder="0903456128" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item
          name="area"
          label="Phường/Xã"
          tooltip="Dùng để lọc và xếp chuyến giao."
          extra={showExtras ? undefined : UNSUPPORTED_HINT}
          rules={[{ max: 80 }]}
        >
          <WardSelect disabled={!showExtras} />
        </Form.Item>
        <Form.Item name="note" label="Ghi chú" extra={showExtras ? undefined : UNSUPPORTED_HINT} rules={[{ max: 500 }]}>
          <TextArea rows={2} maxLength={500} placeholder="Giờ nhận hàng thuận tiện, người liên hệ, lưu ý giao nhận..." disabled={!showExtras} />
        </Form.Item>
        {!customer && <p className="af-form-hint">Thêm địa chỉ giao trong hồ sơ khách sau khi lưu.</p>}
      </Form>
    </Modal>
  )
}
