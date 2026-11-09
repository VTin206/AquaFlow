import { useIsDemo } from '@/shared/features'
import { LiveReturnsPanel } from './LiveReturnsPanel'
import { useState } from 'react'
import { App, Form, Input, InputNumber, Modal, Table, Tag, Typography } from 'antd'
import { awaitingReturnInspection, deliveryAttempts, returnLinesOf, type Order, type ReturnInspectionDraft } from '@/features/orders/types'
import { useOrderAction, useOrders } from '@/features/orders/useOrders'
import { isoToVnDate } from '../expiry'
import { modalWidth } from '@/shared/utils/modal'
import { ReturnsView, type ReturnHistoryRow } from './ReturnsView'

/** Đơn giao thất bại có hàng mang về: kiểm từng lô trước khi nhập lại kho. */
export function ReturnsPanel() {
  return useIsDemo() ? <DemoReturnsPanel /> : <LiveReturnsPanel />
}

function DemoReturnsPanel() {
  const ordersQuery = useOrders()
  const [orderId, setOrderId] = useState<string | null>(null)
  const orders = ordersQuery.data ?? []
  const pending = orders.filter(awaitingReturnInspection)
  const order = pending.find((item) => item.id === orderId)
  const history = orders.flatMap((item) =>
    (item.returnInspections ?? []).map((inspection, index): ReturnHistoryRow => ({
      id: `${item.id}-${index + 1}`,
      orderCode: item.code ?? item.id,
      createdAt: inspection.at,
      note: inspection.note,
      lines: inspection.lines.map((line, lineIndex) => ({
        key: `${line.productId}-${lineIndex}`,
        productName: line.name,
        lotCode: line.lotCode,
        quantity: line.quantity,
        sellable: line.sellable,
      })),
    })),
  )

  return (
    <ReturnsView
      pending={pending.map((item) => ({
        key: item.id,
        orderCode: item.code ?? item.id,
        recipient: item.customer,
        reason:
          deliveryAttempts(item)
            .filter((attempt) => !attempt.success)
            .at(-1)?.reason ?? null,
        goods: returnLinesOf(item)
          .map((line) => `${line.quantity} × ${line.name}`)
          .join(', '),
      }))}
      pendingLoading={ordersQuery.isPending}
      onInspect={(row) => setOrderId(String(row.key))}
      history={history}
      historyLoading={ordersQuery.isPending}
    >
      {order && <ReturnInspectionModal key={order.id} order={order} onClose={() => setOrderId(null)} />}
    </ReturnsView>
  )
}

type FormValues = { sellable: (number | null)[]; note?: string }

function ReturnInspectionModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const { message } = App.useApp()
  const action = useOrderAction()
  const [form] = Form.useForm<FormValues>()
  const lines = returnLinesOf(order)
  const sellable = Form.useWatch('sellable', form) ?? []
  const damaged = lines.reduce((sum, line, index) => sum + line.quantity - (sellable[index] ?? 0), 0)

  const submit = ({ sellable: values, note }: FormValues) => {
    const draft: ReturnInspectionDraft = { sellable: values.map((value) => value ?? 0), note }
    action.mutate(
      { kind: 'inspectReturn', id: order.id, draft },
      {
        onSuccess: () => {
          message.success(`Đã kiểm hàng hoàn đơn ${order.id}.`)
          onClose()
        },
        onError: (error) => message.error(error.message),
      },
    )
  }

  return (
    <Modal
      open
      title={`Kiểm hàng hoàn · ${order.id}`}
      okText="Xác nhận tiếp nhận"
      cancelText="Hủy"
      confirmLoading={action.isPending}
      onCancel={onClose}
      onOk={() => form.submit()}
      width={modalWidth.medium}
    >
      <Form form={form} layout="vertical" initialValues={{ sellable: lines.map((line) => line.quantity) }} onFinish={submit}>
        <Table
          className="af-data-table"
          size="small"
          rowKey={(_, index) => String(index)}
          pagination={false}
          dataSource={lines}
          scroll={{ x: 520 }}
          columns={[
            { title: 'Sản phẩm', dataIndex: 'name', ellipsis: true },
            {
              title: 'Lô',
              key: 'lot',
              width: 130,
              render: (_, line) =>
                line.lotCode ? (
                  <div className="af-cell-stack">
                    <span>{line.lotCode}</span>
                    {line.expiryDate && <small>HSD {isoToVnDate(line.expiryDate)}</small>}
                  </div>
                ) : (
                  <Typography.Text type="secondary">Không theo lô</Typography.Text>
                ),
            },
            { title: 'Mang về', dataIndex: 'quantity', align: 'right', width: 80 },
            {
              title: 'Bán lại được',
              key: 'sellable',
              width: 120,
              render: (_, line, index) => (
                <Form.Item name={['sellable', index]} noStyle rules={[{ required: true }]}>
                  <InputNumber
                    min={0}
                    max={line.quantity}
                    precision={0}
                    aria-label={`Số bán lại được ${line.name}`}
                    style={{ width: 90 }}
                  />
                </Form.Item>
              ),
            },
            {
              title: 'Hỏng',
              key: 'damaged',
              align: 'right',
              width: 70,
              render: (_, line, index) => {
                const value = line.quantity - (sellable[index] ?? 0)
                return value > 0 ? <Tag color="red">{value}</Tag> : 0
              },
            },
          ]}
        />
        <Form.Item
          name="note"
          label="Ghi chú tình trạng"
          style={{ marginTop: 16 }}
          rules={[{ required: damaged > 0, whitespace: true, message: 'Có hàng hỏng, ghi rõ tình trạng.' }, { max: 300 }]}
        >
          <Input.TextArea rows={2} placeholder={damaged > 0 ? 'Bình nứt, móp, mất niêm phong...' : 'Không bắt buộc'} />
        </Form.Item>
        <p className="af-form-hint">Phần bán lại được nhập lại đúng lô. Đơn sau đó có thể giao lại (giữ hàng mới) hoặc hủy.</p>
      </Form>
    </Modal>
  )
}
