import { useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { App, Checkbox, Form, Input, InputNumber, Modal, Select, Skeleton, Space } from 'antd'
import { QueryError } from '@/shared/components/QueryError'
import { currency } from '@/shared/utils/format'
import { modalWidth } from '@/shared/utils/modal'
import { invalidateLiveData } from './invalidateLiveData'
import { orderReturnApi, refundAfterReturn, returnValue, useOrderReturns, type OrderReturnInput } from './orderReturnApi'
import type { OrderBalance } from './paymentApi'

type ReturnForm = {
  quantities?: Record<number, number | null>
  restock: boolean
  reason: string
  refundMethod: 'CASH' | 'BANK_TRANSFER'
  refundReference?: string
}

const refundMethods = [
  { value: 'CASH', label: 'Tiền mặt' },
  { value: 'BANK_TRANSFER', label: 'Chuyển khoản' },
]

type Props = {
  order: { id: number; orderCode: string; subtotal: number; discountAmount: number }
  balance?: OrderBalance
  onClose: () => void
}

/** Khách trả lại hàng đã nhận. Giá trị đơn giảm theo hàng trả; khách đã trả vượt phần còn lại thì hoàn ngay. */
export function LiveOrderReturnModal({ order, balance, onClose }: Props) {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const summary = useOrderReturns(order.id)
  const [form] = Form.useForm<ReturnForm>()
  const values = Form.useWatch([], form)
  // Gửi lại cùng nội dung (mất mạng, bấm hai lần) dùng lại mã yêu cầu để BE không nhận trả hai lần.
  const request = useRef<{ payload: string; id: string } | null>(null)
  const save = useMutation({
    mutationFn: (input: Omit<OrderReturnInput, 'requestId'>) => {
      const payload = JSON.stringify(input)
      if (request.current?.payload !== payload) request.current = { payload, id: crypto.randomUUID() }
      return orderReturnApi.create(order.id, { ...input, requestId: request.current.id })
    },
    onSuccess: (saved) => {
      void invalidateLiveData(queryClient)
      message.success(
        Number(saved.refunded) > 0
          ? `Đã nhận trả hàng và hoàn ${currency(saved.refunded)} cho khách.`
          : `Đã nhận trả hàng, giảm ${currency(saved.value)} trên đơn ${order.orderCode}.`,
      )
      onClose()
    },
    // Đơn có thể vừa đổi ở nơi khác (đã trả, đã thu thêm): tải lại số còn trả được.
    onError: (error: Error) => {
      void invalidateLiveData(queryClient)
      message.error(error.message)
    },
  })

  const items = summary.data?.items ?? []
  const lines = items
    .map((item) => ({ ...item, quantity: values?.quantities?.[item.orderItemId] ?? 0 }))
    .filter((line) => line.quantity > 0)
  const value = returnValue(lines, Number(order.subtotal), Number(order.discountAmount))
  const refund = balance ? refundAfterReturn(balance, value) : 0
  const nothingLeft = summary.isSuccess && items.every((item) => item.returnable === 0)

  return (
    <Modal
      open
      title={`Nhận trả hàng · ${order.orderCode}`}
      okText={refund > 0 ? `Nhận trả và hoàn ${currency(refund)}` : 'Nhận trả hàng'}
      cancelText="Hủy"
      onCancel={() => {
        if (!save.isPending) onClose()
      }}
      onOk={() => form.submit()}
      okButtonProps={{ disabled: value <= 0 || !balance }}
      confirmLoading={save.isPending}
      closable={!save.isPending}
      width={modalWidth.small}
      destroyOnHidden
    >
      {summary.isError ? (
        <QueryError error={summary.error} onRetry={summary.refetch} />
      ) : summary.isPending ? (
        <Skeleton active />
      ) : nothingLeft ? (
        <p className="af-order-more-empty">Khách đã trả hết hàng của đơn này.</p>
      ) : (
        <Form<ReturnForm>
          form={form}
          layout="vertical"
          preserve={false}
          disabled={save.isPending}
          initialValues={{ restock: true, refundMethod: 'CASH', quantities: {} }}
          onFinish={(form) => {
            if (save.isPending) return
            save.mutate({
              reason: form.reason.trim(),
              restock: form.restock,
              lines: lines.map((line) => ({ orderItemId: line.orderItemId, quantity: line.quantity })),
              ...(refund > 0 && {
                refund: { method: form.refundMethod, ...(form.refundReference?.trim() && { reference: form.refundReference.trim() }) },
              }),
            })
          }}
        >
          <div className="af-return-lines">
            {items.map((item) => (
              <Form.Item
                key={item.orderItemId}
                name={['quantities', item.orderItemId]}
                label={`${item.productName} (còn trả được ${item.returnable})`}
              >
                <InputNumber min={0} max={item.returnable} precision={0} disabled={!item.returnable} style={{ width: '100%' }} />
              </Form.Item>
            ))}
          </div>
          <Form.Item
            name="restock"
            valuePropName="checked"
            extra="Hàng nhập lại đúng lô khách đã nhận; lô đã hết hạn thì không nhập lại được."
          >
            <Checkbox>Hàng còn nguyên, nhập lại tồn bán được (bỏ chọn nếu hàng hỏng)</Checkbox>
          </Form.Item>
          <Form.Item
            name="reason"
            label="Lý do trả"
            rules={[
              { required: true, whitespace: true, message: 'Nhập lý do trả hàng.' },
              { max: 500, message: 'Tối đa 500 ký tự.' },
            ]}
          >
            <Input.TextArea rows={2} placeholder="Ví dụ: bình rò nước, giao nhầm loại" />
          </Form.Item>
          <div className="af-order-summary">
            <span>Giá trị hàng trả</span>
            <strong>{currency(value)}</strong>
          </div>
          <div className="af-order-summary">
            <span>Phải hoàn cho khách</span>
            <strong>{currency(refund)}</strong>
          </div>
          {refund > 0 && (
            <Space wrap style={{ marginTop: 12 }}>
              <Form.Item name="refundMethod" label="Cách hoàn tiền" rules={[{ required: true }]}>
                <Select options={refundMethods} style={{ minWidth: 160 }} />
              </Form.Item>
              {values?.refundMethod === 'BANK_TRANSFER' && (
                <Form.Item
                  name="refundReference"
                  label="Mã giao dịch hoàn tiền"
                  rules={[
                    { required: true, whitespace: true, message: 'Nhập mã giao dịch.' },
                    { max: 200, message: 'Tối đa 200 ký tự.' },
                  ]}
                >
                  <Input />
                </Form.Item>
              )}
            </Space>
          )}
          <p className="af-form-hint">
            Giá trị đơn giảm theo hàng trả (phí giao không hoàn). Chỉ hoàn phần khách đã trả vượt giá trị mới của đơn.
          </p>
        </Form>
      )}
    </Modal>
  )
}
