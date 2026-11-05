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
  return <>
    <Alert type="info" showIcon title="Kiểm hàng sau khi chuyến giao thất bại đã kết thúc."
      description="Nhập lại đúng lô phần còn bán được, ghi nhận riêng hàng hỏng. Xác nhận hoàn toàn bộ sẽ hủy đơn. Để giao lại chính đơn này sau kiểm nhận, vào Giao hàng, mở chuyến mới và thêm đơn có nhãn ‘Đã kiểm nhận, giao lại’. Phiếu hoàn không tự hoàn tiền." />
    <Tabs items={[
      { key: 'pending', label: `Chờ kiểm (${pending.data?.length ?? 0})`, children: pending.isError
        ? <QueryError error={pending.error} onRetry={pending.refetch} />
        : <Table rowKey="orderId" loading={pending.isPending} dataSource={pending.data} scroll={{ x: 650 }} columns={[
          { title: 'Đơn hàng', dataIndex: 'orderCode' }, { title: 'Người nhận', dataIndex: 'recipientName' },
          { title: 'Lý do giao thất bại', dataIndex: 'failureReason' },
          { title: 'Thao tác', render: (_, row) => <Button type="primary" onClick={() => setSelected(row)}>Kiểm hàng</Button> },
        ]} /> },
      { key: 'history', label: 'Đã kiểm', children: history.isError
        ? <QueryError error={history.error} onRetry={history.refetch} />
        : <><Table rowKey="id" loading={history.isPending} dataSource={history.data} pagination={false} columns={[
          { title: 'Phiếu', dataIndex: 'id' }, { title: 'Đơn', dataIndex: 'orderCode' },
          { title: 'Ngày kiểm', dataIndex: 'createdAt', render: (v: string) => new Date(v).toLocaleString('vi-VN') },
          { title: 'Thao tác', render: (_, row) => <Button onClick={() => setDetail(row)}>Chi tiết</Button> },
        ]} /><Space style={{ padding: 12 }}><Button disabled={page === 0} onClick={() => setPage(page - 1)}>Trước</Button>
          Trang {page + 1}<Button disabled={!history.data || history.data.length < 20} onClick={() => setPage(page + 1)}>Sau</Button></Space></> },
    ]} />
    {selected && <InspectionModal key={selected.orderId} order={selected} onClose={() => setSelected(null)} />}
    <Modal open={!!detail} onCancel={() => setDetail(null)} footer={null} title={`Phiếu hoàn #${detail?.id ?? ''}`} width={800}>
      <p>Đơn {detail?.orderCode} · Người kiểm #{detail?.performedBy}</p>
      <Table rowKey="loadItemId" dataSource={detail?.lines} pagination={false} scroll={{ x: 600 }} columns={[
        { title: 'Sản phẩm', dataIndex: 'productName' }, { title: 'Lô', dataIndex: 'lotCode' },
        { title: 'Mang về', dataIndex: 'quantity' }, { title: 'Nhập kho', dataIndex: 'sellable' },
        { title: 'Loại bỏ', render: (_, row) => row.quantity - (row.sellable ?? 0) },
      ]} /><p>{detail?.note}</p>
    </Modal>
  </>
}

function InspectionModal({ order, onClose }: { order: PendingReturn; onClose: () => void }) {
  const { message } = App.useApp()
  const client = useQueryClient()
  const [form] = Form.useForm<{ sellable: number[]; note?: string }>()
  const quantities: number[] = Form.useWatch('sellable', form) ?? []
  const damaged = order.lines.some((line, i) => (quantities[i] ?? line.quantity) < line.quantity)
  const mutation = useMutation({ mutationFn: returnApi.inspectAttempt, onSuccess: async () => {
    await invalidateLiveData(client)
    message.success('Đã kiểm nhận hàng hoàn và hủy đơn.')
    onClose()
  }, onError: (error: Error) => message.error(error.message) })
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  return <Modal open title={`Kiểm hoàn · ${order.orderCode}`} width={850} onCancel={onClose}
    okText="Nhận hàng hoàn và hủy đơn" confirmLoading={mutation.isPending} onOk={() => form.submit()}>
    <Alert type="warning" showIcon title="Xác nhận đã nhận đủ hàng bên dưới. Phiếu không thể sửa sau khi lưu." />
    <Form form={form} layout="vertical" initialValues={{ sellable: order.lines.map(line => line.expiresOn <= today ? 0 : line.quantity) }}
      onFinish={values => mutation.mutate({ attemptId: order.attemptId, note: values.note, lines: order.lines.map((line, i) => ({ loadItemId: line.loadItemId, sellable: values.sellable[i] })) })}>
      <Table rowKey="loadItemId" dataSource={order.lines} pagination={false} scroll={{ x: 650 }} columns={[
        { title: 'Sản phẩm', dataIndex: 'productName' }, { title: 'Lô', dataIndex: 'lotCode' }, { title: 'HSD', dataIndex: 'expiresOn' },
        { title: 'Mang về', dataIndex: 'quantity' },
        { title: 'Bán lại được', render: (_, row, i) => <Form.Item name={['sellable', i]} noStyle rules={[{ required: true }, { type: 'integer', min: 0, max: row.expiresOn <= today ? 0 : row.quantity }]}>
          <InputNumber min={0} max={row.expiresOn <= today ? 0 : row.quantity} precision={0} /></Form.Item> },
        { title: 'Loại bỏ', render: (_, row, i) => row.quantity - (quantities[i] ?? 0) },
      ]} />
      <Form.Item name="note" label="Ghi chú tình trạng" rules={[{ required: damaged, whitespace: true, message: 'Ghi rõ tình trạng hàng loại bỏ' }, { max: 300 }]}>
        <Input.TextArea rows={2} maxLength={300} />
      </Form.Item>
    </Form>
  </Modal>
}
