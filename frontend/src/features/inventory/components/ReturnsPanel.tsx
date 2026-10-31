import { useState } from 'react'
import { App, Alert, Button, Empty, Form, Input, InputNumber, Modal, Table, Tag, Typography } from 'antd'
import { PackageCheck } from 'lucide-react'
import { awaitingReturnInspection, deliveryAttempts, returnLinesOf, type Order, type ReturnInspectionDraft } from '@/features/orders/types'
import { useOrderAction, useOrders } from '@/features/orders/useOrders'
import { isoToVnDate } from '../expiry'

/** Đơn giao thất bại có hàng mang về: kiểm từng lô trước khi nhập lại kho. */
export function ReturnsPanel() {
  const ordersQuery = useOrders()
  const [orderId, setOrderId] = useState<string | null>(null)
  const pending = (ordersQuery.data ?? []).filter(awaitingReturnInspection)
  const order = pending.find((item) => item.id === orderId)

  return (
    <>
      <Alert
        type="info"
        showIcon
        className="af-panel-alert"
        title="Hàng giao thất bại không tự cộng lại vào kho."
        description="Kiểm từng lô mang về: phần còn bán được nhập lại kho (RETURN), phần hỏng loại bỏ. Xong mới giao lại hoặc hủy đơn."
      />
      <Table<Order>
        className="af-data-table af-table-flush"
        size="middle"
        rowKey="id"
        loading={ordersQuery.isPending}
        dataSource={pending}
        pagination={false}
        scroll={{ x: 760 }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có hàng hoàn chờ kiểm." /> }}
        columns={[
          {
            title: 'Đơn',
            dataIndex: 'id',
            width: 150,
            render: (id: string, item) => (
              <div className="af-cell-stack">
                <span className="af-strong">{id}</span>
                <small>{item.customer}</small>
              </div>
            ),
          },
          {
            title: 'Lý do giao thất bại',
            key: 'reason',
            ellipsis: true,
            render: (_, item) => deliveryAttempts(item).filter((attempt) => !attempt.success).at(-1)?.reason ?? '—',
          },
          {
            title: 'Hàng mang về',
            key: 'lines',
            render: (_, item) => returnLinesOf(item).map((line) => `${line.quantity} ${line.unit.toLowerCase()} ${line.name}`).join(', '),
          },
          {
            title: 'Thao tác',
            key: 'action',
            width: 130,
            render: (_, item) => (
              <Button size="small" type="primary" icon={<PackageCheck size={15} />} onClick={() => setOrderId(item.id)}>
                Kiểm hàng
              </Button>
            ),
          },
        ]}
      />
      {order && <ReturnInspectionModal key={order.id} order={order} onClose={() => setOrderId(null)} />}
    </>
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
    action.mutate({ kind: 'inspectReturn', id: order.id, draft }, {
      onSuccess: () => {
        message.success(`Đã kiểm hàng hoàn đơn ${order.id}.`)
        onClose()
      },
      onError: (error) => message.error(error.message),
    })
  }

  return (
    <Modal
      open
      title={`Kiểm hàng hoàn · ${order.id}`}
      okText="Xác nhận tiếp nhận"
      cancelText="Đóng"
      confirmLoading={action.isPending}
      onCancel={onClose}
      onOk={() => form.submit()}
      width={640}
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
              render: (_, line) => (line.lotCode ? (
                <div className="af-cell-stack">
                  <span>{line.lotCode}</span>
                  {line.expiryDate && <small>HSD {isoToVnDate(line.expiryDate)}</small>}
                </div>
              ) : <Typography.Text type="secondary">Không theo lô</Typography.Text>),
            },
            { title: 'Mang về', dataIndex: 'quantity', align: 'right', width: 80 },
            {
              title: 'Bán lại được',
              key: 'sellable',
              width: 120,
              render: (_, line, index) => (
                <Form.Item name={['sellable', index]} noStyle rules={[{ required: true }]}>
                  <InputNumber min={0} max={line.quantity} precision={0} aria-label={`Số bán lại được ${line.name}`} style={{ width: 90 }} />
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
