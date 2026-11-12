import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Checkbox, Form, InputNumber, Modal, Select, Skeleton, Space, Table, Tag } from 'antd'
import { useStaff } from '@/features/auth/useStaff'
import { bottleLedgerApi, type BottleInput, type BottleLedger } from '@/features/live/bottleLedgerApi'
import { invalidateLiveData } from '@/features/live/invalidateLiveData'
import { QueryError } from '@/shared/components/QueryError'
import { currency } from '@/shared/utils/format'
import { customerKeys } from './useCustomers'
import { TextArea } from '@/shared/components/TextArea'

const labels: Record<string, string> = {
  GIVE: 'Giao vỏ',
  RECEIVE: 'Thu vỏ',
  LOSS: 'Mất / vỡ',
  COLLECT: 'Thu cọc',
  REFUND: 'Hoàn cọc',
  ADJUST_GIVE: 'Điều chỉnh tăng vỏ',
  ADJUST_RECEIVE: 'Điều chỉnh giảm vỏ',
  ADJUST_COLLECT: 'Điều chỉnh tăng cọc',
  ADJUST_REFUND: 'Điều chỉnh giảm cọc',
}
type Draft = Omit<BottleInput, 'requestId' | 'kind'>

function BottleForm({
  kind,
  ledger,
  record,
  onClose,
}: {
  kind: BottleInput['kind']
  ledger: BottleLedger
  record: (input: BottleInput) => Promise<unknown>
  onClose: () => void
}) {
  const [form] = Form.useForm<Draft>()
  const { message } = App.useApp()
  const client = useQueryClient()
  const pending = useRef(false)
  const retry = useRef<{ payload: string; id: string } | null>(null)
  const typeId = Form.useWatch('bottleTypeId', form)
  const type = ledger.types.find((t) => t.bottleTypeId === typeId)
  const counts = ['GIVE', 'RECEIVE', 'LOSS'].includes(kind)
  const types = ledger.types.filter((t) => (kind === 'GIVE' ? t.active : t.held > 0))
  const save = useMutation({
    mutationFn: record,
    onSuccess: async () => {
      message.success('Đã ghi vào sổ vỏ và tiền cọc.')
      await Promise.all([invalidateLiveData(client), client.invalidateQueries({ queryKey: customerKeys.all })])
      onClose()
    },
    onError: (error: Error) => {
      message.error(error.message)
      void invalidateLiveData(client)
    },
    onSettled: () => {
      pending.current = false
    },
  })
  return (
    <Modal
      open
      title={labels[kind]}
      onCancel={() => {
        if (!save.isPending) onClose()
      }}
      onOk={() => form.submit()}
      okText="Xác nhận ghi nhận"
      cancelText="Hủy"
      confirmLoading={save.isPending}
      cancelButtonProps={{ disabled: save.isPending }}
    >
      <p>
        {kind === 'GIVE'
          ? 'Dùng cho giao vỏ ngoài luồng giao hàng hoặc bàn giao tại quầy. Chuyến giao có liên kết đã tự ghi vỏ khi giao thành công; không ghi lại. Ghi rõ mã đơn hoặc lý do để đối chiếu.'
          : kind === 'LOSS'
            ? 'Giảm số vỏ khách giữ và cấn trừ cọc theo nghĩa vụ của số vỏ mất/vỡ, tối đa bằng cọc đang giữ. Không phải hoàn tiền cho khách.'
            : kind === 'RECEIVE'
              ? 'Ghi nhận vỏ thực tế đã thu về. Hoàn tiền cọc là thao tác riêng sau khi kiểm tra số dư.'
              : 'Chỉ xác nhận sau khi đã thực tế thu hoặc hoàn tiền. Tiền cọc được theo dõi riêng với tiền mua nước.'}
      </p>
      <Form
        form={form}
        layout="vertical"
        disabled={save.isPending}
        initialValues={counts ? { quantity: 1 } : { amount: kind === 'REFUND' ? ledger.balance.refundable : undefined }}
        onFinish={(values) => {
          if (pending.current) return
          const draft = { kind, ...values, note: values.note?.trim() || undefined }
          const payload = JSON.stringify(draft)
          if (retry.current?.payload !== payload) retry.current = { payload, id: crypto.randomUUID() }
          pending.current = true
          save.mutate({ ...draft, requestId: retry.current.id })
        }}
      >
        {kind === 'RECEIVE' && (
          <Form.Item>
            <Checkbox disabled>Thu hồi tận nơi (chưa hỗ trợ)</Checkbox>
          </Form.Item>
        )}
        {counts ? (
          <>
            <Form.Item name="bottleTypeId" label="Loại vỏ" rules={[{ required: true, message: 'Chọn loại vỏ.' }]}>
              <Select options={types.map((t) => ({ value: t.bottleTypeId, label: `${t.name} · đang giữ ${t.held} vỏ` }))} />
            </Form.Item>
            <Form.Item
              name="quantity"
              label="Số vỏ"
              rules={[
                { required: true, message: 'Nhập số vỏ.' },
                {
                  type: 'integer',
                  min: 1,
                  max: kind === 'GIVE' ? 2147483647 : type?.held,
                  message: 'Số vỏ phải nguyên dương và không vượt số đang giữ.',
                },
              ]}
            >
              <InputNumber min={1} max={kind === 'GIVE' ? 2147483647 : type?.held} precision={0} />
            </Form.Item>
          </>
        ) : (
          <Form.Item
            name="amount"
            label={kind === 'REFUND' ? `Số tiền hoàn (tối đa ${currency(ledger.balance.refundable)})` : 'Số tiền cọc (₫)'}
            rules={[
              { required: true, message: 'Nhập số tiền.' },
              {
                type: 'number',
                min: 0.01,
                max: kind === 'REFUND' ? ledger.balance.refundable : 999999999999.99,
                message: 'Số tiền vượt giới hạn cho phép.',
              },
            ]}
          >
            <InputNumber
              min={0.01}
              max={kind === 'REFUND' ? ledger.balance.refundable : 999999999999.99}
              precision={2}
              style={{ width: '100%' }}
            />
          </Form.Item>
        )}
        <Form.Item
          name="note"
          label="Lý do / mã đơn để đối chiếu"
          rules={[
            { required: ['GIVE', 'LOSS', 'REFUND'].includes(kind), whitespace: true, message: 'Nhập lý do hoặc mã đơn.' },
            { max: 300 },
          ]}
        >
          <TextArea rows={2} maxLength={300} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

/** Sổ vỏ và tiền cọc của một khách. */
export function LiveBottleLedger({ customerId }: { customerId: number | string }) {
  const staff = useStaff()
  const [kind, setKind] = useState<BottleInput['kind']>()
  const query = useQuery({
    queryKey: ['live', 'bottle-ledger', staff?.name, staff?.role, customerId],
    queryFn: () => bottleLedgerApi.ledger(Number(customerId)),
    refetchInterval: 15000,
  })
  const data = query.data
  if (!data) return query.isError ? <QueryError error={query.error} onRetry={query.refetch} /> : <Skeleton active />
  return (
    <>
      {query.isError && (
        <Alert
          type="warning"
          showIcon
          title="Chưa cập nhật được số dư"
          description={<Button onClick={() => void query.refetch()}>Thử lại</Button>}
        />
      )}
      <p>
        Đang giữ <strong>{data.balance.bottlesHeld} vỏ</strong> · Cọc đang giữ <strong>{currency(data.balance.depositHeld)}</strong>
      </p>
      <p>
        Cọc cần giữ cho vỏ chưa trả: {currency(data.balance.requiredDeposit)} ·{' '}
        <Tag color="green">Có thể hoàn {currency(data.balance.refundable)}</Tag>
      </p>
      <Space wrap style={{ marginBottom: 16 }}>
        <Button onClick={() => setKind('GIVE')} disabled={!data.balance.active || !data.types.some((t) => t.active)}>
          Giao vỏ
        </Button>
        <Button onClick={() => setKind('RECEIVE')} disabled={data.balance.bottlesHeld <= 0}>
          Thu vỏ
        </Button>
        <Button onClick={() => setKind('COLLECT')}>Thu cọc</Button>
        {staff?.role === 'ADMIN' && (
          <>
            <Button onClick={() => setKind('REFUND')} disabled={data.balance.refundable <= 0}>
              Hoàn cọc
            </Button>
            <Button danger onClick={() => setKind('LOSS')} disabled={data.balance.bottlesHeld <= 0}>
              Báo mất/vỡ
            </Button>
          </>
        )}
        <Button onClick={() => void query.refetch()} loading={query.isFetching}>
          Làm mới
        </Button>
      </Space>
      <Table
        rowKey="bottleTypeId"
        size="small"
        dataSource={data.types.filter((t) => t.held !== 0)}
        pagination={false}
        scroll={{ x: 400 }}
        locale={{ emptyText: 'Khách không giữ vỏ nào.' }}
        columns={[
          { title: 'Loại vỏ', dataIndex: 'name' },
          { title: 'Đang giữ', dataIndex: 'held', align: 'right' },
          { title: 'Cọc cần giữ', dataIndex: 'liability', render: currency, align: 'right' },
        ]}
      />
      <h3>Lịch sử vỏ & cọc</h3>
      <Table
        rowKey="id"
        size="small"
        dataSource={data.entries}
        pagination={{ pageSize: 8, hideOnSinglePage: true }}
        scroll={{ x: 650 }}
        locale={{ emptyText: 'Chưa có giao dịch vỏ hoặc tiền cọc.' }}
        columns={[
          { title: 'Thời điểm', dataIndex: 'at', render: (value) => new Date(value).toLocaleString('vi-VN') },
          {
            title: 'Nghiệp vụ',
            render: (_, entry) => (
              <div>
                {labels[entry.kind] ?? entry.kind}
                <br />
                <small>
                  {entry.bottleType} {entry.note}
                </small>
              </div>
            ),
          },
          { title: 'Vỏ (+/−)', dataIndex: 'bottles', align: 'right' },
          { title: 'Cọc (+/−)', dataIndex: 'deposit', render: currency, align: 'right' },
          { title: 'Người ghi', dataIndex: 'actor' },
        ]}
      />
      <p className="af-form-hint">
        Số dư cộng dồn từ lịch sử. Đổi giá cọc của loại vỏ không làm thay đổi nghĩa vụ đã ghi nhận. Sổ này ghi nhận vỏ thực tế, không tự
        tăng hoặc giảm tồn kho nước.
      </p>
      {kind && (
        <BottleForm
          key={kind}
          kind={kind}
          ledger={data}
          record={(input) => bottleLedgerApi.create(Number(customerId), input)}
          onClose={() => setKind(undefined)}
        />
      )}
    </>
  )
}
