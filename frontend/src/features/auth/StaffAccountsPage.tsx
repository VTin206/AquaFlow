import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Card, Descriptions, Form, Input, Modal, Select, Table, Tag } from 'antd'
import { KeyRound, Pencil, Plus } from 'lucide-react'
import { ViewButton } from '@/shared/components/ViewButton'
import { Page } from '@/shared/components/Page'
import { QueryError } from '@/shared/components/QueryError'
import { useConfirm } from '@/shared/components/confirm'
import { useConfirmDiscard } from '@/shared/hooks/useConfirmDiscard'
import { useAuth } from './useAuth'
import { staffApi, type StaffAccount, type StaffCreate, type StaffUpdate } from './staffApi'
import { roleLabel } from './roles'

type Action = { kind: 'create' } | { kind: 'edit' | 'password'; account: StaffAccount }
export function StaffAccountsPage() {
  const { user } = useAuth()
  const client = useQueryClient()
  const { message } = App.useApp()
  const [action, setAction] = useState<Action | null>(null)
  const [viewingId, setViewingId] = useState<number>()
  const query = useQuery({ queryKey: ['live', 'staff-accounts', user?.email], queryFn: staffApi.list })
  const save = useMutation({
    mutationFn: (operation: () => Promise<unknown>) => operation(),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['live'] })
      setAction(null)
      message.success('Đã lưu tài khoản nhân viên.')
    },
    onError: (error) => message.error(error.message),
  })
  return (
    <Page
      title="Tài khoản nhân viên"
      actions={
        <Button type="primary" icon={<Plus size={16} />} onClick={() => setAction({ kind: 'create' })}>
          Thêm nhân viên
        </Button>
      }
    >
      {query.isError ? (
        <QueryError error={query.error} onRetry={query.refetch} />
      ) : (
        <Card>
          <Table<StaffAccount>
            rowKey="id"
            loading={query.isPending}
            dataSource={query.data}
            scroll={{ x: 720 }}
            columns={[
              { title: 'Họ tên', dataIndex: 'fullName' },
              { title: 'Email đăng nhập', dataIndex: 'email' },
              { title: 'Vai trò', dataIndex: 'role', render: roleLabel },
              { title: 'Điện thoại', dataIndex: 'phone', render: (phone: string | null) => phone || '—' },
              {
                title: 'Trạng thái',
                dataIndex: 'status',
                render: (value) => (
                  <Tag color={value === 'ACTIVE' ? 'green' : 'default'}>{value === 'ACTIVE' ? 'Đang hoạt động' : 'Đã khóa'}</Tag>
                ),
              },
              {
                title: 'Thao tác',
                width: 112,
                align: 'center' as const,
                render: (_, account) => <ViewButton subject={account.fullName} onClick={() => setViewingId(account.id)} />,
              },
            ]}
          />
        </Card>
      )}
      <AccountDetails
        account={query.data?.find((account) => account.id === viewingId)}
        onClose={() => setViewingId(undefined)}
        onAction={(kind, account) => setAction({ kind, account })}
      />
      {action && (
        <AccountForm
          key={action.kind + ('account' in action ? action.account.id : '')}
          action={action}
          saving={save.isPending}
          onClose={() => setAction(null)}
          onSave={(values) =>
            save.mutate(() =>
              action.kind === 'create'
                ? staffApi.create(values as StaffCreate)
                : action.kind === 'edit'
                  ? staffApi.update(action.account.id, values as StaffUpdate)
                  : staffApi.password(action.account.id, values.password!),
            )
          }
        />
      )}
    </Page>
  )
}

/** Xem tài khoản trước; sửa, khóa và đặt mật khẩu ít dùng nên nằm trong cửa sổ này thay vì ngoài bảng. */
function AccountDetails({
  account,
  onClose,
  onAction,
}: {
  account?: StaffAccount
  onClose: () => void
  onAction: (kind: 'edit' | 'password', account: StaffAccount) => void
}) {
  return (
    // Rộng mặc định như cửa sổ đặt mật khẩu và sửa thông tin để mở chồng lên nhau không bị lệch khung.
    <Modal
      open={account !== undefined}
      centered
      onCancel={onClose}
      title={account?.fullName}
      footer={
        account && (
          <div className="af-order-footer">
            <div />
            <div>
              <Button icon={<KeyRound size={15} />} onClick={() => onAction('password', account)}>
                Đặt mật khẩu
              </Button>
              <Button type="primary" icon={<Pencil size={15} />} onClick={() => onAction('edit', account)}>
                Sửa / khóa
              </Button>
            </div>
          </div>
        )
      }
    >
      {account && (
        <Descriptions
          column={1}
          size="small"
          items={[
            { key: 'email', label: 'Email đăng nhập', children: account.email },
            { key: 'role', label: 'Vai trò', children: roleLabel(account.role) },
            { key: 'phone', label: 'Điện thoại', children: account.phone || '—' },
            {
              key: 'status',
              label: 'Trạng thái',
              children: (
                <Tag color={account.status === 'ACTIVE' ? 'green' : 'default'}>
                  {account.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã khóa'}
                </Tag>
              ),
            },
          ]}
        />
      )}
    </Modal>
  )
}

function AccountForm({
  action,
  saving,
  onClose,
  onSave,
}: {
  action: Action
  saving: boolean
  onClose: () => void
  onSave: (value: Partial<StaffCreate & StaffUpdate>) => void
}) {
  const [form] = Form.useForm()
  const confirm = useConfirm()
  const discard = useConfirmDiscard(form, onClose)
  // Khóa, mở khóa và đặt lại mật khẩu ảnh hưởng ngay tới việc đăng nhập của nhân viên: hỏi lại trước khi lưu.
  const submit = async (values: Partial<StaffCreate & StaffUpdate>) => {
    if (action.kind === 'password') {
      const ok = await confirm({
        title: `Đặt mật khẩu mới cho ${action.account.fullName}?`,
        content: <p>Mật khẩu cũ hết hiệu lực ngay; nhân viên phải đăng nhập bằng mật khẩu mới.</p>,
        okText: 'Đặt mật khẩu',
        danger: true,
      })
      if (!ok) return
    }
    if (action.kind === 'edit' && values.status && values.status !== action.account.status) {
      const locking = values.status === 'INACTIVE'
      const ok = await confirm({
        title: `${locking ? 'Khóa' : 'Mở khóa'} tài khoản ${action.account.fullName}?`,
        content: (
          <p>
            {locking ? 'Nhân viên không đăng nhập được cho tới khi mở khóa lại.' : 'Nhân viên đăng nhập lại được bằng mật khẩu hiện có.'}
          </p>
        ),
        okText: locking ? 'Khóa tài khoản' : 'Mở khóa',
        danger: locking,
      })
      if (!ok) return
    }
    onSave(values)
  }
  return (
    <Modal
      open
      title={action.kind === 'create' ? 'Thêm nhân viên' : action.kind === 'edit' ? 'Cập nhật nhân viên' : 'Đặt mật khẩu mới'}
      onCancel={discard}
      closable={!saving}
      maskClosable={!saving}
      onOk={() => form.submit()}
      confirmLoading={saving}
      cancelButtonProps={{ disabled: saving }}
      okText="Lưu"
      cancelText="Hủy"
    >
      <Form
        form={form}
        layout="vertical"
        disabled={saving}
        onFinish={submit}
        initialValues={action.kind === 'create' ? { role: 'SALES_STAFF' } : { ...action.account, phone: action.account.phone ?? '' }}
      >
        {action.kind !== 'password' && (
          <>
            <Form.Item name="fullName" label="Họ tên" rules={[{ required: true, whitespace: true }, { max: 150 }]}>
              <Input autoComplete="name" />
            </Form.Item>
            <Form.Item name="phone" label="Điện thoại" rules={[{ max: 20 }]}>
              <Input inputMode="tel" />
            </Form.Item>
          </>
        )}
        {action.kind === 'create' && (
          <>
            <Form.Item name="email" label="Email đăng nhập" rules={[{ required: true }, { type: 'email' }, { max: 150 }]}>
              <Input autoComplete="off" />
            </Form.Item>
            <Form.Item name="role" label="Vai trò" rules={[{ required: true }]}>
              <Select options={['SALES_STAFF', 'DELIVERY_STAFF'].map((value) => ({ value, label: roleLabel(value) }))} />
            </Form.Item>
          </>
        )}
        {action.kind === 'edit' && (
          <Form.Item name="status" label="Trạng thái" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'ACTIVE', label: 'Đang hoạt động' },
                { value: 'INACTIVE', label: 'Khóa tài khoản' },
              ]}
            />
          </Form.Item>
        )}
        {action.kind !== 'edit' && (
          <Form.Item
            name="password"
            label="Mật khẩu"
            extra="Ít nhất 12 ký tự. Gửi riêng cho nhân viên; mật khẩu không được hiển thị lại sau khi lưu."
            rules={[
              { required: true },
              { min: 12, max: 72 },
              {
                validator: (_, value: string) =>
                  !value || new TextEncoder().encode(value).length <= 72
                    ? Promise.resolve()
                    : Promise.reject(new Error('Mật khẩu tối đa 72 byte UTF-8.')),
              },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}
