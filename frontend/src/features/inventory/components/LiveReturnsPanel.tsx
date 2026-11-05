import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Form, Input, InputNumber, Modal, Space, Table, Tabs } from 'antd'
import { returnApi, usePendingReturns, type PendingReturn, type ReturnInspection } from '@/features/live/returnApi'
import { invalidateLiveData } from '@/features/live/invalidateLiveData'
import { QueryError } from '@/shared/components/QueryError'

export function LiveReturnsPanel() {
  const pending = usePendingReturns()
  const [page, setPage] = useState(0)
  const history = useQuery({ queryKey: ['live', 'returns', 'history', page], queryFn: () => returnApi.list(page) })
  const [selected, setSelected] = useState<PendingReturn | null>(null)
  const [detail, setDetail] = useState<ReturnInspection | null>(null)
  return (
    <>
      <Alert
        type="info"
        showIcon
        title="Kiểm hàng sau khi chuyến giao thất bại đã kết thúc."
        description="Nhập số lượng thực nhận từng lô trong đợt này; chỉ phần bán lại được được cộng tồn. Hàng chưa mang về tiếp tục chờ kiểm ở đợt sau. Chỉ khi đã kiểm đủ hàng, đơn mới được hủy và có thể xếp chuyến giao lại. Phiếu hoàn không tự hoàn tiền."
      />
      <Tabs
        items={[
          {
            key: 'pending',
            label: `Chờ kiểm (${pending.data?.length ?? 0})`,
            children: pending.isError ? (
              <QueryError error={pending.error} onRetry={pending.refetch} />
            ) : (
              <Table
                rowKey="orderId"
                loading={pending.isPending}
                dataSource={pending.data}
                scroll={{ x: 650 }}
                columns={[
                  { title: 'Đơn hàng', dataIndex: 'orderCode' },
                  { title: 'Người nhận', dataIndex: 'recipientName' },
                  { title: 'Lý do giao thất bại', dataIndex: 'failureReason' },
                  {
                    title: 'Thao tác',
                    render: (_, row) => (
                      <Button type="primary" onClick={() => setSelected(row)}>
                        Kiểm hàng
                      </Button>
                    ),
                  },
                ]}
              />
            ),
          },
          {
            key: 'history',
            label: 'Đã kiểm',
            children: history.isError ? (
              <QueryError error={history.error} onRetry={history.refetch} />
            ) : (
              <>
                <Table
                  rowKey="id"
                  loading={history.isPending}
                  dataSource={history.data}
                  pagination={false}
                  columns={[
                    { title: 'Phiếu', dataIndex: 'id' },
                    { title: 'Đơn', dataIndex: 'orderCode' },
                    { title: 'Ngày kiểm', dataIndex: 'createdAt', render: (v: string) => new Date(v).toLocaleString('vi-VN') },
                    { title: 'Thao tác', render: (_, row) => <Button onClick={() => setDetail(row)}>Chi tiết</Button> },
                  ]}
                />
                <Space style={{ padding: 12 }}>
                  <Button disabled={page === 0} onClick={() => setPage(page - 1)}>
                    Trước
                  </Button>
                  Trang {page + 1}
                  <Button disabled={!history.data || history.data.length < 20} onClick={() => setPage(page + 1)}>
                    Sau
                  </Button>
                </Space>
              </>
            ),
          },
        ]}
      />
      {selected && <InspectionModal key={selected.orderId} order={selected} onClose={() => setSelected(null)} />}
      <Modal open={!!detail} onCancel={() => setDetail(null)} footer={null} title={`Phiếu hoàn #${detail?.id ?? ''}`} width={800}>
        <p>
          Đơn {detail?.orderCode} · Người kiểm #{detail?.performedBy}
        </p>
        <Table
          rowKey="loadItemId"
          dataSource={detail?.lines}
          pagination={false}
          scroll={{ x: 600 }}
          columns={[
            { title: 'Sản phẩm', dataIndex: 'productName' },
            { title: 'Lô', dataIndex: 'lotCode' },
            { title: 'Thực nhận đợt này', dataIndex: 'quantity' },
            { title: 'Nhập kho', dataIndex: 'sellable' },
            { title: 'Loại bỏ', render: (_, row) => row.quantity - (row.sellable ?? 0) },
          ]}
        />
        <p>{detail?.note}</p>
      </Modal>
    </>
  )
}

function InspectionModal({ order, onClose }: { order: PendingReturn; onClose: () => void }) {
  const { message } = App.useApp()
  const client = useQueryClient()
  const [requestId] = useState(() => crypto.randomUUID())
  const [form] = Form.useForm<{ lines: { quantity: number; sellable: number }[]; note?: string }>()
  const values: { quantity: number; sellable: number }[] = Form.useWatch('lines', form) ?? []
  const received = values.reduce((sum, line) => sum + (line?.quantity ?? 0), 0)
  const outstanding = order.lines.reduce((sum, line) => sum + line.quantity, 0) - received
  const damaged = values.some((line) => (line?.sellable ?? 0) < (line?.quantity ?? 0))
  const mutation = useMutation({
    mutationFn: returnApi.inspectAttempt,
    onSuccess: async () => {
      await invalidateLiveData(client)
      message.success(
        outstanding > 0
          ? 'Đã lưu đợt nhận hàng. Phần chưa mang về tiếp tục chờ kiểm.'
          : 'Đã kiểm nhận đủ hàng hoàn; có thể xếp chuyến giao lại.',
      )
      onClose()
    },
    onError: (error: Error) => message.error(error.message),
  })
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  return (
    <Modal
      open
      title={`Kiểm hoàn · ${order.orderCode}`}
      width={850}
      onCancel={onClose}
      okText="Lưu đợt nhận hàng"
      confirmLoading={mutation.isPending}
      okButtonProps={{ disabled: received <= 0 }}
      onOk={() => form.submit()}
    >
      <Alert
        type="info"
        showIcon
        title={`Còn chờ sau đợt này: ${Math.max(0, outstanding)}`}
        description="Để 0 nếu lô chưa được mang về. Hàng hỏng = thực nhận − bán lại được; không tính hàng chưa mang về là hàng hỏng. Phiếu đã lưu không thể sửa."
      />
      <Form
        form={form}
        layout="vertical"
        disabled={mutation.isPending}
        initialValues={{ lines: order.lines.map(() => ({ quantity: 0, sellable: 0 })) }}
        onFinish={(input) => {
          const lines = order.lines
            .map((line, i) => ({ loadItemId: line.loadItemId, quantity: input.lines[i].quantity, sellable: input.lines[i].sellable }))
            .filter((line) => line.quantity > 0)
          if (!lines.length) {
            message.error('Nhập ít nhất một lô có hàng thực nhận.')
            return
          }
          mutation.mutate({ attemptId: order.attemptId, requestId, note: input.note, lines })
        }}
      >
        <Table
          rowKey="loadItemId"
          dataSource={order.lines}
          pagination={false}
          scroll={{ x: 650 }}
          columns={[
            { title: 'Sản phẩm', dataIndex: 'productName' },
            { title: 'Lô', dataIndex: 'lotCode' },
            { title: 'HSD', dataIndex: 'expiresOn' },
            { title: 'Còn chờ', dataIndex: 'quantity' },
            {
              title: 'Thực nhận',
              render: (_, row, i) => (
                <Form.Item
                  name={['lines', i, 'quantity']}
                  noStyle
                  rules={[{ required: true }, { type: 'integer', min: 0, max: row.quantity }]}
                >
                  <InputNumber aria-label={`Thực nhận ${row.lotCode}`} min={0} max={row.quantity} precision={0} />
                </Form.Item>
              ),
            },
            {
              title: 'Bán lại được',
              render: (_, row, i) => (
                <Form.Item
                  name={['lines', i, 'sellable']}
                  dependencies={[['lines', i, 'quantity']]}
                  noStyle
                  rules={[{ required: true }, { type: 'integer', min: 0, max: row.expiresOn <= today ? 0 : (values[i]?.quantity ?? 0) }]}
                >
                  <InputNumber
                    aria-label={`Bán lại ${row.lotCode}`}
                    min={0}
                    max={row.expiresOn <= today ? 0 : (values[i]?.quantity ?? 0)}
                    precision={0}
                  />
                </Form.Item>
              ),
            },
            { title: 'Hỏng / loại bỏ', render: (_, _row, i) => Math.max(0, (values[i]?.quantity ?? 0) - (values[i]?.sellable ?? 0)) },
          ]}
        />
        <Form.Item
          name="note"
          label="Ghi chú tình trạng"
          rules={[{ required: damaged, whitespace: true, message: 'Ghi rõ tình trạng hàng loại bỏ' }, { max: 300 }]}
        >
          <Input.TextArea rows={2} maxLength={300} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
