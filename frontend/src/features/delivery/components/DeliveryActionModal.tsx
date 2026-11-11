import { Alert, Form, Input, InputNumber, Modal, Segmented, Select, Tag } from 'antd'
import { QueryError } from '@/shared/components/QueryError'
import { modalWidth } from '@/shared/utils/modal'
import type { DeliveryStop, ResultInput, SettlementInput } from '../deliveryApi'
import { TextArea } from '@/shared/components/TextArea'

export type DeliveryAction = { kind: 'driver' | 'add' | 'settle'; tripId: number } | { kind: 'result'; tripId: number; order: DeliveryStop }
export type DeliveryFormValues = Partial<SettlementInput & ResultInput> & { driverId?: number; orderId?: number }

/** Lý do giao thất bại hay gặp: tài xế chạm để chọn thay vì gõ ngoài đường. */
export const FAILURE_REASONS = ['Khách vắng nhà', 'Không liên lạc được', 'Sai địa chỉ', 'Khách từ chối nhận', 'Khách hẹn ngày khác']

/** Các thao tác có nhập liệu trên chuyến: phân tài xế, thêm đơn, ghi kết quả giao, đối soát. */
export function DeliveryActionModal({
  action,
  expected,
  drivers,
  available,
  optionError,
  onRetry,
  loading,
  onClose,
  onSubmit,
}: {
  action: DeliveryAction
  expected?: { cash: number; bottles: number }
  drivers: { id: number; name: string }[]
  available: { id: number; orderCode: string; recipientName: string | null; deliveryFailed: boolean; redeliveryEligible: boolean }[]
  optionError: Error | null
  onRetry: () => void
  loading: boolean
  onClose: () => void
  onSubmit: (values: DeliveryFormValues) => Promise<void>
}) {
  const [form] = Form.useForm<DeliveryFormValues>()
  const outcome = Form.useWatch('outcome', form) ?? 'SUCCESS'
  const reason: string = Form.useWatch('failureReason', form) ?? ''
  const title = {
    driver: 'Phân tài xế',
    add: 'Thêm đơn vào chuyến',
    result: action.kind === 'result' ? `Kết quả giao · ${action.order.orderCode}` : '',
    settle: 'Đối soát chuyến',
  }[action.kind]
  return (
    <Modal
      open
      centered
      title={title}
      width={modalWidth.small}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={loading}
      okButtonProps={{ disabled: !!optionError || loading }}
      okText="Lưu"
      cancelText="Đóng"
    >
      {optionError && <QueryError error={optionError} onRetry={onRetry} />}
      <Form
        form={form}
        layout="vertical"
        onFinish={onSubmit}
        initialValues={{
          outcome: 'SUCCESS',
          recipientName: action.kind === 'result' ? action.order.recipientName : undefined,
          cashReported: expected?.cash ?? 0,
          cashConfirmed: expected?.cash ?? 0,
          bottlesExpected: expected?.bottles ?? 0,
          bottlesConfirmed: expected?.bottles ?? 0,
        }}
      >
        {action.kind === 'driver' && (
          <>
            <Form.Item name="driverId" label="Tài xế" rules={[{ required: true, message: 'Chọn tài xế.' }]}>
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Chọn tài xế đang hoạt động"
                options={drivers.map((d) => ({ value: d.id, label: d.name }))}
              />
            </Form.Item>
            {!drivers.length && !optionError && <Alert type="info" title="Chưa có tài xế đang hoạt động." />}
          </>
        )}
        {action.kind === 'add' && (
          <Form.Item name="orderId" label="Đơn chờ xếp chuyến" rules={[{ required: true, message: 'Chọn đơn hàng.' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={available.map((o) => ({
                value: o.id,
                label: `${o.orderCode} · ${o.recipientName || 'Khách hàng'}${o.redeliveryEligible ? ' · Giao lại' : ''}`,
              }))}
              notFoundContent="Không có đơn đang chờ xếp chuyến"
            />
          </Form.Item>
        )}
        {action.kind === 'result' && (
          <>
            <Form.Item name="outcome" label="Kết quả" rules={[{ required: true }]}>
              <Segmented
                block
                options={[
                  { value: 'SUCCESS', label: 'Giao thành công' },
                  { value: 'FAILED', label: 'Giao thất bại' },
                ]}
              />
            </Form.Item>
            {outcome === 'SUCCESS' ? (
              <Form.Item
                name="recipientName"
                label="Người nhận thực tế"
                rules={[{ required: true, whitespace: true, message: 'Nhập tên người nhận.' }]}
              >
                <Input maxLength={150} />
              </Form.Item>
            ) : (
              <>
                <div className="af-reason-picks" role="group" aria-label="Chọn nhanh lý do">
                  {FAILURE_REASONS.map((pick) => (
                    <Tag.CheckableTag key={pick} checked={reason === pick} onChange={() => form.setFieldValue('failureReason', pick)}>
                      {pick}
                    </Tag.CheckableTag>
                  ))}
                </div>
                <Form.Item
                  name="failureReason"
                  label="Lý do thất bại"
                  extra="Chạm một lý do ở trên hoặc tự ghi."
                  rules={[{ required: true, whitespace: true, message: 'Chọn hoặc nhập lý do giao thất bại.' }]}
                >
                  <TextArea maxLength={2000} />
                </Form.Item>
              </>
            )}
          </>
        )}
        {action.kind === 'settle' && (
          <>
            <Alert
              type="info"
              title="Ghi nhận tiền và vỏ tài xế bàn giao. Số liệu này không tự thanh toán đơn hoặc nhập lại hàng vào kho."
              style={{ marginBottom: 12 }}
            />
            {(
              [
                ['cashReported', 'Tiền tài xế báo'],
                ['cashConfirmed', 'Tiền thực nhận'],
                ['bottlesExpected', 'Vỏ dự kiến'],
                ['bottlesConfirmed', 'Vỏ thực nhận'],
              ] as const
            ).map(([name, label]) => (
              <Form.Item key={name} name={name} label={label} rules={[{ required: true, message: 'Nhập số lượng / số tiền.' }]}>
                <InputNumber
                  disabled={!!expected && (name === 'cashReported' || name === 'bottlesExpected')}
                  min={0}
                  max={name.startsWith('cash') ? 999999999999.99 : 2147483647}
                  precision={name.startsWith('cash') ? 2 : 0}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            ))}
          </>
        )}
        {(action.kind === 'result' || action.kind === 'settle') && (
          <Form.Item name="note" label={action.kind === 'settle' ? 'Ghi chú / lý do chênh lệch' : 'Ghi chú'}>
            <TextArea maxLength={action.kind === 'result' ? 1000 : 2000} />
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}
