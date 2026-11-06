import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Empty, Form, Input, InputNumber, Modal, Space, Table, Tabs } from 'antd'
import { returnApi, usePendingReturns, type PendingReturn, type ReturnInspection } from '@/features/live/returnApi'
import { invalidateLiveData } from '@/features/live/invalidateLiveData'
import { OrderFocusBanner } from '@/features/orders/components/OrderSheet'
import { QueryError } from '@/shared/components/QueryError'
import { ViewButton } from '@/shared/components/ViewButton'
import { modalWidth } from '@/shared/utils/modal'

export function LiveReturnsPanel() {
  const pending = usePendingReturns()
  const [page, setPage] = useState(0)
  const history = useQuery({ queryKey: ['live', 'returns', 'history', page], queryFn: () => returnApi.list(page) })
  const [selected, setSelected] = useState<PendingReturn | null>(null)
  const [detail, setDetail] = useState<ReturnInspection | null>(null)
  const waiting = pending.data?.length ?? 0
  return (
    <>
      <Tabs
        items={[
          {
            key: 'pending',
            label: `Chờ kiểm (${waiting})`,
            children: pending.isError ? (
              <QueryError error={pending.error} onRetry={pending.refetch} />
            ) : (
              <>
                {waiting > 0 && (
                  <OrderFocusBanner
                    focus={{
                      tone: 'action',
                      title: `Có ${waiting} đơn cần kiểm hàng hoàn`,
                      description: 'Kiểm đủ hàng thì đơn mới giao lại hoặc hủy được. Phiếu hoàn không tự hoàn tiền.',
                    }}
                  />
                )}
                <Table
                  rowKey="orderId"
                  loading={pending.isPending}
                  dataSource={pending.data}
                  scroll={{ x: 650 }}
                  locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có đơn chờ kiểm. Đơn giao thất bại sẽ hiện ở đây." /> }}
                  columns={[
                    { title: 'Đơn hàng', dataIndex: 'orderCode' },
                    { title: 'Người nhận', dataIndex: 'recipientName' },
                    { title: 'Lý do giao thất bại', dataIndex: 'failureReason' },
                    {
                      title: 'Thao tác',
                      render: (_, row) => (
                        <Button size="small" type="primary" onClick={() => setSelected(row)}>
                          Kiểm hàng
                        </Button>
                      ),
                    },
                  ]}
                />
              </>
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
                  locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có phiếu hoàn nào." /> }}
                  columns={[
                    { title: 'Phiếu', dataIndex: 'id' },
                    { title: 'Đơn', dataIndex: 'orderCode' },
                    { title: 'Ngày kiểm', dataIndex: 'createdAt', render: (v: string) => new Date(v).toLocaleString('vi-VN') },
                    { title: 'Thao tác', width: 112, align: 'center' as const, render: (_, row) => <ViewButton subject={`phiếu hoàn #${row.id}`} onClick={() => setDetail(row)} /> },
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
      <Modal
        open={!!detail}
        centered
        onCancel={() => setDetail(null)}
        footer={null}
        title={`Phiếu hoàn #${detail?.id ?? ''} · ${detail?.orderCode ?? ''}`}
        width={modalWidth.medium}
      >
        <Table
          rowKey="loadItemId"
          size="small"
          dataSource={detail?.lines}
          pagination={false}
          scroll={{ x: 600 }}
          columns={[
            { title: 'Sản phẩm', dataIndex: 'productName' },
            { title: 'Lô', dataIndex: 'lotCode' },
            { title: 'Thực nhận đợt này', dataIndex: 'quantity', align: 'right' },
            { title: 'Nhập kho', dataIndex: 'sellable', align: 'right' },
            { title: 'Loại bỏ', align: 'right', render: (_, row) => row.quantity - (row.sellable ?? 0) },
          ]}
        />
        {detail?.note && <p className="af-form-hint">Ghi chú: {detail.note}</p>}
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
  const expired = (expiresOn: string) => expiresOn <= today
  // Việc hay gặp nhất là hàng về đủ và còn tốt: bấm một lần rồi chỉ sửa lô khác đi. Lô đã hết hạn không tính bán lại được.
  const fillAll = () =>
    form.setFieldsValue({
      lines: order.lines.map((line) => ({ quantity: line.quantity, sellable: expired(line.expiresOn) ? 0 : line.quantity })),
    })
  return (
    <Modal
      open
      title={`Kiểm hàng hoàn · ${order.orderCode}`}
      width={modalWidth.medium}
      onCancel={onClose}
      okText="Lưu đợt nhận hàng"
      cancelText="Đóng"
      confirmLoading={mutation.isPending}
      okButtonProps={{ disabled: received <= 0 }}
      onOk={() => form.submit()}
    >
      <OrderFocusBanner
        focus={{
          tone: outstanding > 0 ? 'action' : 'done',
          title: `Còn chờ sau đợt này: ${Math.max(0, outstanding)}`,
          description: 'Lô chưa mang về thì để 0, đợt sau kiểm tiếp. Phiếu đã lưu không sửa được.',
        }}
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
        <div className="af-return-fill">
          <Button size="small" onClick={fillAll}>
            Điền đủ, hàng còn tốt
          </Button>
        </div>
        <Table
          rowKey="loadItemId"
          size="small"
          dataSource={order.lines}
          pagination={false}
          scroll={{ x: 620 }}
          columns={[
            {
              title: 'Sản phẩm / lô',
              key: 'product',
              render: (_, row) => (
                <div className="af-cell-stack">
                  <span>{row.productName}</span>
                  <small className={expired(row.expiresOn) ? 'af-text-danger' : undefined}>
                    Lô {row.lotCode} · HSD {row.expiresOn}
                    {expired(row.expiresOn) ? ' (đã hết hạn)' : ''}
                  </small>
                </div>
              ),
            },
            { title: 'Còn chờ', dataIndex: 'quantity', align: 'right', width: 80 },
            {
              title: 'Thực nhận',
              width: 110,
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
              width: 110,
              render: (_, row, i) => (
                <Form.Item
                  name={['lines', i, 'sellable']}
                  dependencies={[['lines', i, 'quantity']]}
                  noStyle
                  rules={[{ required: true }, { type: 'integer', min: 0, max: expired(row.expiresOn) ? 0 : (values[i]?.quantity ?? 0) }]}
                >
                  <InputNumber
                    aria-label={`Bán lại ${row.lotCode}`}
                    min={0}
                    max={expired(row.expiresOn) ? 0 : (values[i]?.quantity ?? 0)}
                    precision={0}
                  />
                </Form.Item>
              ),
            },
            {
              title: 'Loại bỏ',
              align: 'right',
              width: 80,
              render: (_, _row, i) => Math.max(0, (values[i]?.quantity ?? 0) - (values[i]?.sellable ?? 0)),
            },
          ]}
        />
        <Form.Item
          name="note"
          label="Ghi chú tình trạng"
          style={{ marginTop: 16 }}
          rules={[{ required: damaged, whitespace: true, message: 'Ghi rõ tình trạng hàng loại bỏ' }, { max: 300 }]}
        >
          <Input.TextArea rows={2} maxLength={300} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
