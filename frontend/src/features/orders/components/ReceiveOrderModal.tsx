import { App, Button, Col, Form, Input, InputNumber, Modal, Radio, Row } from 'antd'
import { currency } from '../../../shared/utils/format'
import { DEPOSIT_PER_BOTTLE, EXCHANGEABLE_BRANDS } from '../../../shared/policy'
import { jugCount, type DeliveryResult, type Order } from '../types'
import { useOrderAction } from '../useOrders'

export function ReceiveOrderModal({ order, open, onClose }: { order: Order; open: boolean; onClose: () => void }) {
  const { message } = App.useApp()
  const [form] = Form.useForm<DeliveryResult>()
  const action = useOrderAction()
  const success = Form.useWatch('success', form) ?? true
  const returned = Form.useWatch('bottlesReturned', form) ?? 0
  const counter = order.method === 'Tại quầy'
  const jugs = jugCount(order)
  const tracksBottles = jugs > 0 && Boolean(order.customerId)
  // Khách giữ thêm vỏ thì gợi ý thu cọc theo mức mẫu; người bán vẫn quyết định số thực thu.
  const extraBottles = Math.max(0, jugs - returned)
  const suggestedDeposit = extraBottles * DEPOSIT_PER_BOTTLE

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
        initialValues={{ success: true, receiver: order.customer, bottlesReturned: tracksBottles ? jugs : 0, depositCollected: 0 }}
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
          <>
            <Form.Item name="receiver" label="Người nhận thực tế" rules={[{ required: !counter, whitespace: true, message: 'Nhập người nhận.' }]}>
              <Input />
            </Form.Item>
            {tracksBottles && (
              <fieldset className="af-bottle-fieldset">
                <legend>Vỏ bình · giao {jugs} bình</legend>
                <Row gutter={16}>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      name="bottlesReturned"
                      label="Vỏ rỗng đổi bù"
                      tooltip={`Nhận vỏ cùng dung tích của: ${EXCHANGEABLE_BRANDS.join(', ')}.`}
                      rules={[{ required: true, message: 'Nhập số vỏ thu về.' }, { type: 'integer', min: 0, message: 'Số nguyên không âm.' }]}
                    >
                      <InputNumber min={0} precision={0} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item name="depositCollected" label="Tiền cọc thu thêm (₫)" rules={[{ type: 'integer', min: 0, message: 'Số nguyên không âm.' }]}>
                      <InputNumber min={0} step={DEPOSIT_PER_BOTTLE} precision={0} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
                {extraBottles > 0 && (
                  <p className="af-form-hint">
                    Khách chưa có đủ vỏ đổi: thiếu {extraBottles} vỏ, cọc {currency(DEPOSIT_PER_BOTTLE)}/vỏ = {currency(suggestedDeposit)}{' '}
                    <Button type="link" size="small" onClick={() => form.setFieldValue('depositCollected', suggestedDeposit)}>
                      Áp dụng
                    </Button>
                  </p>
                )}
              </fieldset>
            )}
          </>
        ) : (
          <Form.Item name="reason" label="Lý do giao thất bại" rules={[{ required: true, whitespace: true, message: 'Nhập lý do.' }]}>
            <Input.TextArea rows={3} placeholder="Không liên hệ được khách, sai địa chỉ..." />
          </Form.Item>
        )}
        <p className="af-form-hint">
          Xác nhận nhận hàng không đồng nghĩa với đã thanh toán. Đơn chỉ hoàn tất sau khi đã nhận hàng và thu đủ tiền. Tiền cọc ghi vào sổ vỏ của khách, không tính vào tiền hàng.
        </p>
      </Form>
    </Modal>
  )
}
