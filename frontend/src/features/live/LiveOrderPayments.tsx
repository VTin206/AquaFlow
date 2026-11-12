import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Descriptions, Form, Input, InputNumber, Modal, Select, Skeleton, Space, Table, Tag } from 'antd'
import { QueryError } from '@/shared/components/QueryError'
import { useConfirm } from '@/shared/components/confirm'
import { currency } from '@/shared/utils/format'
import { invalidateLiveData } from './invalidateLiveData'
import { paymentApi, useOrderPayments, type PaymentInput } from './paymentApi'
import { TextArea } from '@/shared/components/TextArea'

export function LiveOrderPayments({ orderId }: { orderId: number }) {
  const query = useOrderPayments(orderId)
  const client = useQueryClient()
  const { message } = App.useApp()
  const ask = useConfirm()
  const [direction, setDirection] = useState<'IN' | 'OUT' | null>(null)
  const [form] = Form.useForm<Pick<PaymentInput, 'amount' | 'method' | 'reference' | 'note'>>()
  const request = useRef<{ id: string; payload: string } | null>(null)
  const lock = useRef(false)
  const mutation = useMutation({
    mutationFn: (input: PaymentInput) => paymentApi.create(orderId, input),
    onSuccess: async () => { setDirection(null); message.success('Đã ghi nhận phiếu thanh toán.'); await invalidateLiveData(client) },
    onError: async () => { await invalidateLiveData(client) },
  })
  const start = (next: 'IN' | 'OUT') => {
    request.current = null; mutation.reset(); setDirection(next)
    form.setFieldsValue({ amount: next === 'IN' ? query.data?.balance.due : query.data?.balance.refundDue, method: 'CASH', reference: '', note: '' })
  }
  const submit = async (values: Pick<PaymentInput, 'amount' | 'method' | 'reference' | 'note'>) => {
    if (!direction || lock.current) return
    lock.current = true
    // Phiếu thu/hoàn ghi vào sổ, không xóa được: nhắc lại số tiền và hình thức trước khi ghi.
    const ok = await ask({
      title: `${direction === 'IN' ? 'Ghi nhận đã thu' : 'Ghi nhận đã hoàn'} ${currency(values.amount)}?`,
      content: (
        <p>
          Hình thức: <strong>{values.method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}</strong>
          {values.reference?.trim() ? ` · mã giao dịch ${values.reference.trim()}` : ''}. Phiếu đã ghi không xóa được.
        </p>
      ),
      okText: direction === 'IN' ? 'Ghi nhận thu' : 'Ghi nhận hoàn',
      danger: direction === 'OUT',
    })
    if (!ok) {
      lock.current = false
      return
    }
    const input = { ...values, direction, reference: values.reference?.trim() || undefined, note: values.note?.trim() || undefined }
    const payload = JSON.stringify(input)
    if (request.current?.payload !== payload) request.current = { id: crypto.randomUUID(), payload }
    try { await mutation.mutateAsync({ ...input, requestId: request.current.id }) } catch { /* Keep form and request id for a safe retry. */ }
    finally { lock.current = false }
  }
  if (!query.data) return query.isError ? <QueryError error={query.error} onRetry={query.refetch} /> : <Skeleton active />
  const { balance, payments } = query.data
  const maximum = direction === 'IN' ? balance.due : balance.refundDue
  return <>
    {query.isError && <Alert type="warning" showIcon title="Chưa làm mới được số dư. Dữ liệu đang hiển thị là lần tải gần nhất." action={<Button onClick={() => void query.refetch()}>Thử lại</Button>} />}
    <Descriptions size="small" column={{ xs: 1, sm: 2 }} items={[
      { key: 'received', label: 'Đã thu', children: currency(balance.received) },
      { key: 'refunded', label: 'Đã hoàn', children: currency(balance.refunded) },
      { key: 'due', label: 'Còn phải thu', children: currency(balance.due) },
      { key: 'refund', label: 'Cần hoàn khách', children: currency(balance.refundDue) },
    ]} />
    <Space style={{ marginBottom: 12 }}>
      {balance.status !== 'PENDING' && balance.status !== 'CANCELLED' && balance.due > 0 && <Button type="primary" onClick={() => start('IN')}>Ghi nhận thu tiền</Button>}
      {balance.refundDue > 0 && <Button onClick={() => start('OUT')}>Ghi nhận hoàn tiền</Button>}
    </Space>
    <Table rowKey="id" size="small" dataSource={payments} pagination={{ pageSize: 5, hideOnSinglePage: true }} scroll={{ x: 620 }} locale={{ emptyText: 'Chưa có phiếu thanh toán.' }} columns={[
      { title: 'Phiếu', render: (_, p) => <span>#{p.id} <Tag color={p.direction === 'IN' ? 'green' : 'orange'}>{p.direction === 'IN' ? 'Thu' : 'Hoàn'}</Tag></span> },
      { title: 'Số tiền', dataIndex: 'amount', render: currency, align: 'right' },
      { title: 'Hình thức', render: (_, p) => p.method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản' },
      { title: 'Người ghi nhận', render: (_, p) => <>{p.recordedByName}{p.source === 'DELIVERY' && <small> · Thu khi giao hàng</small>}</> },
      { title: 'Thời gian', dataIndex: 'createdAt', render: value => new Date(value).toLocaleString('vi-VN') },
      { title: 'Mã giao dịch / ghi chú', render: (_, p) => [p.reference, p.note].filter(Boolean).join(' · ') },
    ]} />
    <Modal forceRender open={direction !== null} title={direction === 'IN' ? 'Ghi nhận thu tiền' : 'Ghi nhận hoàn tiền'} okText="Xác nhận đã giao dịch" cancelText="Hủy" onOk={() => form.submit()} confirmLoading={mutation.isPending} onCancel={() => { if (!mutation.isPending) setDirection(null) }} cancelButtonProps={{ disabled: mutation.isPending }}>
      <Alert type="info" showIcon title="Chỉ xác nhận khi đã thực nhận hoặc hoàn tiền. Hệ thống ghi sổ, không tự chuyển tiền qua ngân hàng." style={{ marginBottom: 16 }} />
      {mutation.isError && <Alert type="error" title={mutation.error.message} showIcon style={{ marginBottom: 16 }} />}
      <Form form={form} layout="vertical" onFinish={submit} disabled={mutation.isPending}>
        <Form.Item name="amount" label="Số tiền" rules={[{ required: true, message: 'Nhập số tiền.' }, { type: 'number', min: 0.01, max: Number(maximum), message: `Số tiền phải lớn hơn 0 và không vượt ${currency(maximum)}.` }]}><InputNumber precision={2} min={0.01} max={Number(maximum)} style={{ width: '100%' }} /></Form.Item>
        <Form.Item name="method" label="Hình thức" rules={[{ required: true }]}><Select options={[{ value: 'CASH', label: 'Tiền mặt' }, { value: 'BANK_TRANSFER', label: 'Chuyển khoản' }]} /></Form.Item>
        <Form.Item name="reference" label="Mã giao dịch (nếu có)" rules={[{ max: 200 }]}><Input /></Form.Item>
        <Form.Item name="note" label="Lý do / ghi chú" rules={[{ required: direction === 'OUT', whitespace: true, message: 'Nhập lý do hoàn tiền.' }, { max: 200 }]}><TextArea rows={2} maxLength={200} /></Form.Item>
      </Form>
    </Modal>
  </>
}
