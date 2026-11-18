import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Checkbox, Form, Input, Modal, Popconfirm, Skeleton, Tag } from 'antd'
import { Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { useAuth } from '@/features/auth/useAuth'
import { QueryError } from '@/shared/components/QueryError'
import { accountKey, customerAccountApi, phoneRules, type AddressInput, type PasswordChange, type SavedAddress } from './customerAccountApi'
import { currency } from '@/shared/utils/format'
import { WardSelect } from '@/shared/address/WardSelect'
import { TextArea } from '@/shared/components/TextArea'

const cleanPhone = (phone: string) => phone.replace(/[\s().-]/g, '')

/** Vỏ khách đang giữ và tiền cọc; cọc còn được hoàn do cửa hàng trả khi khách trả vỏ. */
function BottlesSection({ queryKey }: { queryKey: readonly unknown[] }) {
  const bottles = useQuery({ queryKey, queryFn: customerAccountApi.bottles })
  return (
    <section aria-label="Vỏ bình và cọc">
      <h2>Vỏ bình và cọc</h2>
      {bottles.isPending ? (
        <Skeleton active paragraph={{ rows: 2 }} />
      ) : bottles.isError ? (
        <QueryError error={bottles.error} onRetry={bottles.refetch} />
      ) : (
        <>
          {bottles.data.bottles.length ? (
            <ul className="af-account-bottles">
              {bottles.data.bottles.map((line) => (
                <li key={line.bottleTypeId}>
                  <span>{line.name}</span>
                  <strong>{line.holding} vỏ</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="af-account-empty">Bạn không giữ vỏ nào của cửa hàng.</p>
          )}
          <dl className="af-account-deposit">
            <div>
              <dt>Cọc đã nộp</dt>
              <dd>{currency(bottles.data.depositPaid)}</dd>
            </div>
            {bottles.data.refundable > 0 && (
              <div>
                <dt>Cọc còn được hoàn</dt>
                <dd>{currency(bottles.data.refundable)}</dd>
              </div>
            )}
          </dl>
          {bottles.data.refundable > 0 && <p className="af-form-hint">Liên hệ cửa hàng để nhận lại phần cọc này.</p>}
        </>
      )}
    </section>
  )
}

/** Đổi mật khẩu: thành công thì mọi phiên hết hạn nên đăng xuất ngay và mời đăng nhập lại. */
function PasswordSection() {
  const { logout } = useAuth()
  const { message } = App.useApp()
  const [form] = Form.useForm<PasswordChange & { confirm: string }>()
  const change = useMutation({
    mutationFn: customerAccountApi.changePassword,
    onSuccess: () => {
      message.success('Đã đổi mật khẩu. Vui lòng đăng nhập lại bằng mật khẩu mới.')
      logout()
    },
  })
  return (
    <section aria-label="Đổi mật khẩu">
      <h2>Đổi mật khẩu</h2>
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        disabled={change.isPending}
        onFinish={(values) => change.mutate({ currentPassword: values.currentPassword, newPassword: values.newPassword })}
      >
        <Form.Item name="currentPassword" label="Mật khẩu hiện tại" rules={[{ required: true, message: 'Nhập mật khẩu hiện tại.' }]}>
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <div className="af-account-pair">
          <Form.Item
            name="newPassword"
            label="Mật khẩu mới"
            rules={[
              { required: true, message: 'Nhập mật khẩu mới.' },
              { min: 8, message: 'Ít nhất 8 ký tự.' },
              { max: 128 },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirm"
            label="Nhập lại mật khẩu mới"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: 'Nhập lại mật khẩu mới.' },
              ({ getFieldValue }) => ({
                validator: (_, value) =>
                  !value || value === getFieldValue('newPassword') ? Promise.resolve() : Promise.reject(new Error('Hai mật khẩu chưa khớp.')),
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </div>
        {change.isError && <Alert type="error" showIcon title={change.error.message} style={{ marginBottom: 12 }} />}
        <p className="af-form-hint">Đổi xong bạn sẽ được đăng xuất khỏi mọi thiết bị.</p>
        <Button htmlType="submit" loading={change.isPending}>
          Đổi mật khẩu
        </Button>
      </Form>
    </section>
  )
}

/** Hồ sơ và sổ địa chỉ của khách: hai cột trên màn hình rộng, mỗi địa chỉ một dòng. */
export function CustomerAccountPanel() {
  const { user, updateProfile } = useAuth()
  const client = useQueryClient()
  const { message } = App.useApp()
  const key = accountKey(user?.email)
  const profile = useQuery({ queryKey: [...key, 'profile'], queryFn: customerAccountApi.profile })
  const addresses = useQuery({ queryKey: [...key, 'addresses'], queryFn: customerAccountApi.addresses })
  const [editing, setEditing] = useState<SavedAddress | 'new' | null>(null)
  const [addressForm] = Form.useForm<AddressInput>()
  const saveProfile = useMutation({
    mutationFn: customerAccountApi.updateProfile,
    onSuccess: async (data) => {
      client.setQueryData([...key, 'profile'], data)
      updateProfile(data)
      message.success('Đã lưu hồ sơ.')
      await client.invalidateQueries({ queryKey: key })
    },
  })
  const saveAddress = useMutation({
    mutationFn: (values: AddressInput) => {
      const input = {
        recipientName: values.recipientName.trim(),
        recipientPhone: cleanPhone(values.recipientPhone),
        addressLine: values.addressLine.trim(),
        area: values.area.trim(),
        isDefault: !!values.isDefault,
      }
      return editing && editing !== 'new' ? customerAccountApi.updateAddress(editing.id, input) : customerAccountApi.createAddress(input)
    },
    onSuccess: async () => {
      setEditing(null)
      message.success('Đã lưu địa chỉ.')
      await client.invalidateQueries({ queryKey: key })
    },
  })
  const remove = useMutation({
    mutationFn: customerAccountApi.deleteAddress,
    onSuccess: async () => {
      message.success('Đã xóa địa chỉ.')
      await client.invalidateQueries({ queryKey: key })
    },
  })
  const makeDefault = useMutation({
    mutationFn: (address: SavedAddress) =>
      customerAccountApi.updateAddress(address.id, {
        recipientName: address.recipientName,
        recipientPhone: address.recipientPhone,
        addressLine: address.addressLine,
        area: address.area,
        isDefault: true,
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: key })
    },
  })
  const busy = saveAddress.isPending || remove.isPending || makeDefault.isPending
  const edit = (address: SavedAddress | 'new') => {
    saveAddress.reset()
    addressForm.resetFields()
    addressForm.setFieldsValue(
      address === 'new'
        ? {
            recipientName: profile.data?.fullName ?? '',
            recipientPhone: profile.data?.phone ?? '',
            addressLine: '',
            area: '',
            isDefault: !addresses.data?.length,
          }
        : address,
    )
    setEditing(address)
  }
  return (
    <div className="af-shop-account-grid af-account-panel">
      <section aria-label="Hồ sơ của tôi">
        <h2>Hồ sơ của tôi</h2>
        {profile.isPending ? (
          <Skeleton active />
        ) : profile.isError ? (
          <QueryError error={profile.error} onRetry={profile.refetch} />
        ) : (
          <Form
            key={`${profile.data.fullName}-${profile.data.phone}`}
            layout="vertical"
            requiredMark={false}
            initialValues={profile.data}
            onFinish={(values) => saveProfile.mutate({ fullName: values.fullName.trim(), phone: cleanPhone(values.phone) })}
            disabled={saveProfile.isPending}
          >
            <Form.Item label="Email đăng nhập">
              <Input value={profile.data.email} disabled />
            </Form.Item>
            <div className="af-account-pair">
              <Form.Item
                name="fullName"
                label="Họ và tên"
                rules={[{ required: true, whitespace: true, message: 'Nhập họ và tên.' }, { max: 150 }]}
              >
                <Input autoComplete="name" />
              </Form.Item>
              <Form.Item name="phone" label="Số điện thoại" rules={phoneRules}>
                <Input autoComplete="tel" inputMode="tel" />
              </Form.Item>
            </div>
            {saveProfile.isError && <Alert type="error" showIcon title={saveProfile.error.message} style={{ marginBottom: 12 }} />}
            <Button type="primary" htmlType="submit" loading={saveProfile.isPending}>
              Lưu hồ sơ
            </Button>
          </Form>
        )}
      </section>
      <section aria-label="Sổ địa chỉ">
        <div className="af-account-head">
          <h2>Sổ địa chỉ</h2>
          <Button icon={<Plus size={16} />} onClick={() => edit('new')} disabled={busy || !addresses.isSuccess}>
            Thêm địa chỉ
          </Button>
        </div>
        {addresses.isPending ? (
          <Skeleton active />
        ) : addresses.isError ? (
          <QueryError error={addresses.error} onRetry={addresses.refetch} />
        ) : !addresses.data.length ? (
          <p className="af-account-empty">Bạn chưa lưu địa chỉ nào.</p>
        ) : (
          <ul className="af-account-addresses">
            {addresses.data.map((address) => (
              <li key={address.id}>
                <div>
                  <strong>
                    {address.recipientName} · {address.recipientPhone} {address.isDefault && <Tag color="blue">Mặc định</Tag>}
                  </strong>
                  <span>
                    {address.addressLine}, {address.area}
                  </span>
                </div>
                {!address.isDefault && (
                  <Button
                    type="text"
                    icon={<Star size={16} />}
                    aria-label="Đặt mặc định"
                    title="Đặt mặc định"
                    disabled={busy}
                    onClick={() => makeDefault.mutate(address)}
                  />
                )}
                <Button
                  type="text"
                  icon={<Pencil size={16} />}
                  aria-label="Sửa"
                  title="Sửa"
                  disabled={busy}
                  onClick={() => edit(address)}
                />
                <Popconfirm
                  title="Xóa địa chỉ này?"
                  description="Đơn hàng đã đặt vẫn giữ nguyên địa chỉ giao."
                  okText="Xóa"
                  cancelText="Giữ lại"
                  disabled={busy}
                  onConfirm={() => remove.mutate(address.id)}
                >
                  <Button type="text" danger icon={<Trash2 size={16} />} aria-label="Xóa" title="Xóa" disabled={busy} />
                </Popconfirm>
              </li>
            ))}
          </ul>
        )}
        {(remove.isError || makeDefault.isError) && (
          <Alert type="error" showIcon title={remove.error?.message ?? makeDefault.error?.message} style={{ marginTop: 12 }} />
        )}
      </section>
      <BottlesSection queryKey={[...key, 'bottles']} />
      <PasswordSection />
      <Modal
        forceRender
        centered
        title={editing === 'new' ? 'Thêm địa chỉ' : 'Sửa địa chỉ'}
        open={editing !== null}
        onCancel={() => {
          if (!saveAddress.isPending) setEditing(null)
        }}
        onOk={() => addressForm.submit()}
        okText="Lưu địa chỉ"
        cancelText="Hủy"
        confirmLoading={saveAddress.isPending}
        cancelButtonProps={{ disabled: saveAddress.isPending }}
      >
        <Form
          form={addressForm}
          layout="vertical"
          onFinish={(values) => {
            if (!saveAddress.isPending) saveAddress.mutate(values)
          }}
          disabled={saveAddress.isPending}
        >
          <div className="af-account-pair">
            <Form.Item name="recipientName" label="Tên người nhận" rules={[{ required: true, whitespace: true }, { max: 150 }]}>
              <Input />
            </Form.Item>
            <Form.Item name="recipientPhone" label="Điện thoại người nhận" rules={phoneRules}>
              <Input inputMode="tel" />
            </Form.Item>
          </div>
          <Form.Item name="area" label="Phường/Xã" rules={[{ required: true, whitespace: true, message: 'Chọn phường/xã.' }, { max: 150 }]}>
            <WardSelect />
          </Form.Item>
          <Form.Item name="addressLine" label="Địa chỉ" rules={[{ required: true, whitespace: true }, { max: 255 }]}>
            <TextArea rows={2} maxLength={255} />
          </Form.Item>
          <Form.Item name="isDefault" valuePropName="checked" style={{ marginBottom: 0 }}>
            <Checkbox>Địa chỉ mặc định</Checkbox>
          </Form.Item>
          {saveAddress.isError && <Alert type="error" showIcon title={saveAddress.error.message} style={{ marginTop: 12 }} />}
        </Form>
      </Modal>
    </div>
  )
}
