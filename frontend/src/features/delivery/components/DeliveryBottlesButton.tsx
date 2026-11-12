import { useRef, useState } from 'react'
import { Alert, App, Button, Form, InputNumber, Modal, Skeleton, Table } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/useAuth'
import { customerKeys } from '@/features/customers/useCustomers'
import { invalidateLiveData } from '@/features/live/invalidateLiveData'
import { QueryError } from '@/shared/components/QueryError'
import { currency } from '@/shared/utils/format'
import { deliveryBottleApi, type BottleReturnInput } from '../deliveryBottleApi'

export function DeliveryBottlesButton({ assignmentId, orderCode }: { assignmentId: number; orderCode: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Vỏ của đơn</Button>
      {open && <DeliveryBottlesModal assignmentId={assignmentId} orderCode={orderCode} onClose={() => setOpen(false)} />}
    </>
  )
}

export function DeliveryBottlesModal({
  assignmentId,
  orderCode,
  onClose,
}: {
  assignmentId: number
  orderCode: string
  onClose: () => void
}) {
  const { user } = useAuth()
  const client = useQueryClient()
  const { message } = App.useApp()
  const [form] = Form.useForm<Record<string, number>>()
  const lock = useRef(false)
  const retry = useRef<{ payload: string; id: string } | null>(null)
  const query = useQuery({
    queryKey: ['live', 'delivery-bottles', user?.email, assignmentId],
    queryFn: () => deliveryBottleApi.get(assignmentId),
  })
  const save = useMutation({
    mutationFn: (input: BottleReturnInput) => deliveryBottleApi.receive(assignmentId, input),
    onSuccess: async () => {
      message.success('Đã thu vỏ và cập nhật sổ khách hàng.')
      form.resetFields()
      retry.current = null
      await Promise.all([invalidateLiveData(client), client.invalidateQueries({ queryKey: customerKeys.all })])
    },
    onError: (error: Error) => {
      message.error(error.message)
      void query.refetch()
    },
    onSettled: () => {
      lock.current = false
    },
  })
  const data = query.data
  return (
    <Modal
      open
      title={`Vỏ của đơn · ${orderCode}`}
      footer={null}
      onCancel={() => {
        if (!save.isPending) onClose()
      }}
      closable={!save.isPending}
      width={720}
    >
      {!data ? (
        query.isError ? (
          <QueryError error={query.error} onRetry={query.refetch} />
        ) : (
          <Skeleton active />
        )
      ) : (
        <>
          {query.isError && (
            <Alert
              type="warning"
              title="Chưa cập nhật được số liệu"
              action={<Button onClick={() => void query.refetch()}>Thử lại</Button>}
            />
          )}
          {!data.tracked ? (
            <Alert
              type="info"
              title="Chưa có dữ liệu liên kết vỏ"
              description="Dữ liệu được chốt khi khởi hành. Chuyến đã khởi hành trước khi có tính năng này cần cửa hàng đối chiếu và ghi sổ thủ công để tránh ghi trùng."
            />
          ) : !data.linkedCustomer ? (
            <Alert
              type="warning"
              title="Đơn chưa liên kết hồ sơ khách hàng"
              description="Chưa tự ghi sổ vỏ cho đơn này. Liên hệ cửa hàng để đối chiếu khách hàng và số vỏ thực giao."
            />
          ) : (
            <p>
              {data.given
                ? 'Vỏ giao thành công đã tự ghi vào sổ khách. Nhập đúng số vỏ thực nhận của từng loại để cập nhật sổ và tổng vỏ bàn giao chuyến.'
                : 'Số vỏ dưới đây được chốt khi khởi hành; chỉ tự ghi vào sổ khách khi giao thành công.'}
            </p>
          )}
          {data.tracked && (
            <>
              <Table
                rowKey="bottleTypeId"
                size="small"
                pagination={false}
                dataSource={data.lines}
                scroll={{ x: 450 }}
                locale={{ emptyText: 'Đơn này không có sản phẩm gắn loại vỏ.' }}
                columns={[
                  { title: 'Loại vỏ', dataIndex: 'name' },
                  { title: data.given ? 'Đã giao' : 'Dự kiến giao', dataIndex: 'given' },
                  { title: 'Đã thu', dataIndex: 'returned' },
                  { title: 'Cọc / vỏ khi khởi hành', dataIndex: 'unitDeposit', render: currency },
                ]}
              />
              {data.canReturn && data.lines.some((l) => l.returned < l.given) && (
                <Form
                  form={form}
                  layout="vertical"
                  disabled={save.isPending}
                  onFinish={(values) => {
                    if (lock.current) return
                    const lines = data.lines
                      .map((l) => ({ bottleTypeId: l.bottleTypeId, quantity: values[String(l.bottleTypeId)] ?? 0 }))
                      .filter((l) => l.quantity > 0)
                    if (!lines.length) {
                      message.warning('Nhập ít nhất một vỏ thực nhận.')
                      return
                    }
                    const payload = JSON.stringify(lines)
                    if (retry.current?.payload !== payload) retry.current = { payload, id: crypto.randomUUID() }
                    lock.current = true
                    save.mutate({ requestId: retry.current.id, lines })
                  }}
                >
                  <h3>Thu vỏ thực tế</h3>
                  {data.lines
                    .filter((l) => l.returned < l.given)
                    .map((l) => (
                      <Form.Item
                        key={l.bottleTypeId}
                        name={String(l.bottleTypeId)}
                        label={`${l.name} — còn tối đa ${l.given - l.returned} vỏ`}
                        initialValue={0}
                        rules={[
                          {
                            type: 'integer',
                            min: 0,
                            max: l.given - l.returned,
                            message: 'Số vỏ phải nguyên và trong giới hạn còn được đổi.',
                          },
                        ]}
                      >
                        <InputNumber min={0} max={l.given - l.returned} precision={0} />
                      </Form.Item>
                    ))}
                  <Button type="primary" htmlType="submit" loading={save.isPending} disabled={query.isError}>
                    Xác nhận đã thu vỏ
                  </Button>
                </Form>
              )}
              <p>Thu vỏ không tự hoàn cọc hoặc nhập kho nước. Các loại vỏ khác hoặc số vỏ ngoài đơn cần cửa hàng xử lý riêng.</p>
              <h3>Lịch sử thu vỏ</h3>
              <Table
                rowKey={(r) => `${r.requestId}-${r.typeName}`}
                size="small"
                dataSource={data.receipts}
                pagination={{ pageSize: 5, hideOnSinglePage: true }}
                locale={{ emptyText: 'Chưa thu vỏ theo loại.' }}
                scroll={{ x: 450 }}
                columns={[
                  { title: 'Thời gian', dataIndex: 'at', render: (value) => new Date(value).toLocaleString('vi-VN') },
                  { title: 'Loại vỏ', dataIndex: 'typeName' },
                  { title: 'Số vỏ', dataIndex: 'quantity' },
                  { title: 'Người thu', dataIndex: 'actor' },
                ]}
              />
            </>
          )}
        </>
      )}
    </Modal>
  )
}
