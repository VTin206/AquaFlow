import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Form, InputNumber, Modal, Table } from 'antd'
import { returnApi, usePendingReturns, type PendingReturn, type ReturnInspection } from '@/features/live/returnApi'
import { invalidateLiveData } from '@/features/live/invalidateLiveData'
import { OrderFocusBanner } from '@/features/orders/components/OrderSheet'
import { QueryError } from '@/shared/components/QueryError'
import { modalWidth } from '@/shared/utils/modal'
import { isoToVnDate } from '../expiry'
import { ReturnsView, type ReturnHistoryRow } from './ReturnsView'
import { TextArea } from '@/shared/components/TextArea'

export function LiveReturnsPanel() {
  const pending = usePendingReturns()
  const [page, setPage] = useState(0)
  const history = useQuery({ queryKey: ['live', 'returns', 'history', page], queryFn: () => returnApi.list(page) })
  const [selected, setSelected] = useState<PendingReturn | null>(null)
  const rows = pending.data ?? []
  return (
    <ReturnsView
      pending={rows.map((row) => ({
        key: row.orderId,
        orderCode: row.orderCode,
        recipient: row.recipientName,
        reason: row.failureReason,
        goods: row.lines.map((line) => `${line.quantity} × ${line.productName}`).join(', '),
      }))}
      pendingLoading={pending.isPending}
      pendingError={pending.isError ? <QueryError error={pending.error} onRetry={pending.refetch} /> : undefined}
      onInspect={(row) => setSelected(rows.find((item) => item.orderId === row.key) ?? null)}
      history={(history.data ?? []).map(toHistoryRow)}
      historyLoading={history.isPending}
      historyError={history.isError ? <QueryError error={history.error} onRetry={history.refetch} /> : undefined}
      paging={{ page, hasNext: (history.data?.length ?? 0) >= 20, onChange: setPage }}
    >
      {selected && (
        <InspectionModal
          key={selected.orderId}
          order={selected}
          onSave={(input) => returnApi.inspectAttempt({ ...input, attemptId: selected.attemptId })}
          onClose={() => setSelected(null)}
        />
      )}
    </ReturnsView>
  )
}

const toHistoryRow = (row: ReturnInspection): ReturnHistoryRow => ({
  id: row.id,
  orderCode: row.orderCode,
  createdAt: row.createdAt,
  note: row.note,
  lines: row.lines.map((line) => ({
    key: String(line.loadItemId),
    productName: line.productName,
    lotCode: line.lotCode,
    quantity: line.quantity,
    sellable: line.sellable ?? null,
  })),
})

export type InspectionInput = { requestId: string; note?: string; lines: { loadItemId: number; quantity: number; sellable: number }[] }

/** Form kiểm hàng hoàn dùng chung; `partial={false}` khi nơi lưu chỉ nhận đủ toàn bộ hàng trong một đợt. */
export function InspectionModal({
  order,
  onSave,
  onClose,
  partial = true,
}: {
  order: Pick<PendingReturn, 'orderCode' | 'lines'>
  onSave: (input: InspectionInput) => Promise<unknown>
  onClose: () => void
  partial?: boolean
}) {
  const { message } = App.useApp()
  const client = useQueryClient()
  const [requestId] = useState(() => crypto.randomUUID())
  const [form] = Form.useForm<{ lines: { quantity: number; sellable: number }[]; note?: string }>()
  const values: { quantity: number; sellable: number }[] = Form.useWatch('lines', form) ?? []
  const received = values.reduce((sum, line) => sum + (line?.quantity ?? 0), 0)
  const outstanding = order.lines.reduce((sum, line) => sum + line.quantity, 0) - received
  const damaged = values.some((line) => (line?.sellable ?? 0) < (line?.quantity ?? 0))
  const mutation = useMutation({
    mutationFn: onSave,
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
  const expired = (expiresOn: string) => Boolean(expiresOn) && expiresOn <= today
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
          description: partial ? 'Lô chưa mang về thì để 0, đợt sau kiểm tiếp. Phiếu đã lưu không sửa được.' : 'Nhận từng đợt: chưa hỗ trợ ở bản dùng thử. Phiếu đã lưu không sửa được.',
        }}
      />
      <Form
        form={form}
        layout="vertical"
        disabled={mutation.isPending}
        initialValues={{ lines: order.lines.map((line) => (partial ? { quantity: 0, sellable: 0 } : { quantity: line.quantity, sellable: expired(line.expiresOn) ? 0 : line.quantity })) }}
        onFinish={(input) => {
          const lines = order.lines
            .map((line, i) => ({ loadItemId: line.loadItemId, quantity: input.lines[i].quantity, sellable: input.lines[i].sellable }))
            .filter((line) => line.quantity > 0)
          if (!lines.length) {
            message.error('Nhập ít nhất một lô có hàng thực nhận.')
            return
          }
          mutation.mutate({ requestId, note: input.note, lines })
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
                    Lô {row.lotCode} · HSD {row.expiresOn ? isoToVnDate(row.expiresOn) : '—'}
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
                  <InputNumber aria-label={`Thực nhận ${row.lotCode}`} min={0} max={row.quantity} precision={0} disabled={!partial} />
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
          <TextArea rows={2} maxLength={300} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
