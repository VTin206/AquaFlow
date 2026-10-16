import { App, Form, Input, Modal, Radio } from 'antd'
import type { DeliveryResult, Order } from '../types'
import { useOrderAction } from '../useOrders'

export function ReceiveOrderModal({ order, open, onClose }: { order: Order; open: boolean; onClose: () => void }) {
  const { message } = App.useApp()
  const [form] = Form.useForm<DeliveryResult>()
  const action = useOrderAction()
  const success = Form.useWatch('success', form) ?? true
  const counter = order.method === 'Tại quầy'
  return (
    <Modal
      open={open}
      title={counter ? 'Xác nhận khách đã nhận hàng' : 'Ghi nhận kết quả giao'}
      okText="Lưu kết quả"
      cancelText="Đóng"
      destroyOnHidden
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={action.isPending}
    >
      <Form
        form={form}
        layout="vertical"
        preserve={false}
        initialValues={{ success: true, receiver: order.customer }}
        onFinish={(result) =>
          action.mutate(
            { kind: 'receive', id: order.id, result: { ...result, success: counter ? true : result.success } },
            {
              onSuccess: () => {
                message.success('Đã lưu kết quả nhận hàng.')
                onClose()
              },
              onError: (error) => message.error(error.message),
            },
          )
        }
      >
        {!counter && (
          <Form.Item name="success" label="Kết quả">
            <Radio.Group
              options={[
                { value: true, label: 'Giao thành công' },
                { value: false, label: 'Giao thất bại' },
              ]}
            />
          </Form.Item>
        )}
        {success ? (
          <Form.Item name="receiver" label="Người nhận thực tế" rules={[{ required: !counter, whitespace: true, message: 'Nhập người nhận.' }]}>
            <Input />
          </Form.Item>
        ) : (
          <Form.Item name="reason" label="Lý do giao thất bại" rules={[{ required: true, whitespace: true, message: 'Nhập lý do.' }]}>
            <Input.TextArea rows={3} placeholder="Không liên hệ được khách, sai địa chỉ..." />
          </Form.Item>
        )}
        <p className="af-form-hint">Xác nhận nhận hàng không đồng nghĩa với đã thanh toán. Đơn chỉ hoàn tất sau khi đã nhận hàng và thu đủ tiền.</p>
      </Form>
    </Modal>
  )
}
