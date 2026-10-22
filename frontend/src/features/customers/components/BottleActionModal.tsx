import { App, Form, Input, InputNumber, Modal, Radio } from 'antd'
import { PICKUP_FEE, PICKUP_FEE_BELOW } from '../../../shared/policy'
import { currency } from '../../../shared/utils/format'
import { DEPOSIT_PER_BOTTLE, type BottleAction, type Customer } from '../types'
import { useRecordBottles } from '../useCustomers'

export type BottleActionKind = BottleAction['kind']

const copy: Record<BottleActionKind, { title: string; ok: string; hint: string }> = {
  'Thu vỏ': { title: 'Thu vỏ rỗng', ok: 'Ghi nhận thu vỏ', hint: 'Dùng khi khách trả vỏ ngoài đơn giao (ví dụ ngừng dùng nước bình). Vỏ đổi kèm đơn được ghi ở bước nhận hàng.' },
  'Báo mất/vỡ': { title: 'Báo vỏ mất hoặc vỡ', ok: 'Ghi nhận mất/vỡ', hint: `Tiền cọc tương ứng (${currency(DEPOSIT_PER_BOTTLE)}/vỏ) được cấn trừ làm tiền bồi thường, không hoàn lại.` },
  'Thu cọc': { title: 'Thu tiền cọc vỏ', ok: 'Xác nhận đã nhận cọc', hint: 'Tiền cọc là khoản giữ hộ, không tính vào doanh thu bán nước.' },
  'Hoàn cọc': { title: 'Hoàn tiền cọc', ok: 'Xác nhận đã hoàn', hint: 'Chỉ hoàn phần cọc của những vỏ khách đã trả.' },
}

type BottleActionModalProps = { customer: Customer; kind: BottleActionKind | null; refundable: number; onClose: () => void }

export function BottleActionModal({ customer, kind, refundable, onClose }: BottleActionModalProps) {
  const { message } = App.useApp()
  const [form] = Form.useForm<Omit<BottleAction, 'kind'>>()
  const record = useRecordBottles()
  const pickup = Form.useWatch('pickup', form) ?? false
  const bottles = Form.useWatch('bottles', form) ?? 0
  if (!kind) return null
  const text = copy[kind]
  const countsBottles = kind === 'Thu vỏ' || kind === 'Báo mất/vỡ'
  const maxDeposit = kind === 'Hoàn cọc' ? refundable : undefined

  return (
    <Modal
      open
      title={`${text.title} · ${customer.name}`}
      okText={text.ok}
      okButtonProps={{ danger: kind === 'Báo mất/vỡ', disabled: kind === 'Hoàn cọc' && refundable === 0 }}
      cancelText="Đóng"
      confirmLoading={record.isPending}
      onOk={() => form.submit()}
      onCancel={onClose}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        preserve={false}
        initialValues={countsBottles ? { bottles: 1, pickup: false } : { deposit: kind === 'Hoàn cọc' ? refundable : DEPOSIT_PER_BOTTLE }}
        onFinish={(values) =>
          record.mutate(
            { customerId: customer.id, action: { ...values, kind } },
            {
              onSuccess: () => {
                message.success('Đã ghi vào sổ vỏ.')
                onClose()
              },
              onError: (error) => message.error(error.message),
            },
          )
        }
      >
        {kind === 'Thu vỏ' && (
          <Form.Item name="pickup" label="Hình thức thu">
            <Radio.Group
              options={[
                { value: false, label: 'Khách mang vỏ đến cửa hàng' },
                { value: true, label: 'Thu hồi tận nơi' },
              ]}
            />
          </Form.Item>
        )}
        {countsBottles ? (
          <Form.Item
            name="bottles"
            label={`Số vỏ (khách đang giữ ${customer.bottlesHeld})`}
            rules={[{ required: true, message: 'Nhập số vỏ.' }, { type: 'integer', min: 1, max: customer.bottlesHeld, message: `Từ 1 đến ${customer.bottlesHeld} vỏ.` }]}
          >
            <InputNumber min={1} max={customer.bottlesHeld} precision={0} style={{ width: 160 }} autoFocus />
          </Form.Item>
        ) : (
          <Form.Item
            name="deposit"
            label={kind === 'Hoàn cọc' ? `Số tiền hoàn (tối đa ${currency(refundable)})` : 'Số tiền cọc (₫)'}
            rules={[{ required: true, message: 'Nhập số tiền.' }, { type: 'integer', min: 1, max: maxDeposit, message: 'Số tiền không hợp lệ.' }]}
          >
            <InputNumber min={1} max={maxDeposit} step={DEPOSIT_PER_BOTTLE} precision={0} style={{ width: 200 }} autoFocus />
          </Form.Item>
        )}
        <Form.Item name="note" label="Ghi chú" rules={[{ required: kind === 'Báo mất/vỡ', whitespace: true, message: 'Ghi rõ tình huống mất/vỡ.' }, { max: 300 }]}>
          <Input.TextArea rows={2} placeholder={kind === 'Báo mất/vỡ' ? 'Vỏ nứt khi vận chuyển, khách làm mất...' : 'Không bắt buộc'} />
        </Form.Item>
        {kind === 'Thu vỏ' && pickup && (
          <p className="af-form-hint af-text-warning">
            {bottles < PICKUP_FEE_BELOW
              ? `Thu hồi dưới ${PICKUP_FEE_BELOW} vỏ: phí ${currency(PICKUP_FEE)}/lần, cấn trừ vào tiền cọc.`
              : `Từ ${PICKUP_FEE_BELOW} vỏ trở lên: không tính phí cố định, thỏa thuận với khách và ghi vào ghi chú.`}
          </p>
        )}
        <p className="af-form-hint">{kind === 'Hoàn cọc' && refundable === 0 ? `Khách còn giữ ${customer.bottlesHeld} vỏ nên chưa có khoản cọc nào được hoàn. Thu vỏ trước.` : text.hint}</p>
      </Form>
    </Modal>
  )
}
