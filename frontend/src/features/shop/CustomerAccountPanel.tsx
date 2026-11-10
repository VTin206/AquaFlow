import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Card, Checkbox, Empty, Form, Input, Modal, Popconfirm, Skeleton, Space, Tag } from 'antd'
import { useAuth } from '@/features/auth/useAuth'
import { QueryError } from '@/shared/components/QueryError'
import { accountKey, customerAccountApi, phoneRules, type AddressInput, type SavedAddress } from './customerAccountApi'
import { demoCustomerAccountApi } from './demoCustomerData'
import { WardSelect } from '@/shared/address/WardSelect'
import { TextArea } from '@/shared/components/TextArea'

export function CustomerAccountPanel() {
  const { user, updateProfile } = useAuth()
  const client = useQueryClient()
  const { message } = App.useApp()
  const key = accountKey(user?.email)
  // Bản dùng thử xem được hồ sơ và sổ địa chỉ của khách mẫu nhưng chưa lưu thay đổi.
  const demo = Boolean(user?.isDemo)
  const source = demo ? demoCustomerAccountApi : customerAccountApi
  const label = (text: string) => (demo ? `${text} (chưa hỗ trợ)` : text)
  const profile = useQuery({ queryKey: [...key, 'profile'], queryFn: source.profile })
  const addresses = useQuery({ queryKey: [...key, 'addresses'], queryFn: source.addresses })
  const [editing, setEditing] = useState<SavedAddress | 'new' | null>(null)
  const [addressForm] = Form.useForm<AddressInput>()
  const saveProfile = useMutation({
    mutationFn: customerAccountApi.updateProfile,
    onSuccess: async data => {
      client.setQueryData([...key, 'profile'], data)
      updateProfile(data)
      message.success('Đã lưu hồ sơ.')
      await client.invalidateQueries({ queryKey: key })
    },
  })
  const saveAddress = useMutation({
    mutationFn: (values: AddressInput) => {
      const input = { recipientName: values.recipientName.trim(), recipientPhone: values.recipientPhone.replace(/[\s().-]/g, ''), addressLine: values.addressLine.trim(), area: values.area.trim(), isDefault: !!values.isDefault }
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
    onSuccess: async () => { message.success('Đã xóa địa chỉ.'); await client.invalidateQueries({ queryKey: key }) },
  })
  const makeDefault = useMutation({
    mutationFn: (address: SavedAddress) => customerAccountApi.updateAddress(address.id, {
      recipientName: address.recipientName, recipientPhone: address.recipientPhone, addressLine: address.addressLine, area: address.area, isDefault: true,
    }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: key }) },
  })
  const busy = saveAddress.isPending || remove.isPending || makeDefault.isPending
  const edit = (address: SavedAddress | 'new') => {
    saveAddress.reset()
    addressForm.resetFields()
    addressForm.setFieldsValue(address === 'new' ? { recipientName: profile.data?.fullName ?? '', recipientPhone: profile.data?.phone ?? '', addressLine: '', area: '', isDefault: !addresses.data?.length } : address)
    setEditing(address)
  }
  return (
    <Space orientation="vertical" size="large" style={{ width: '100%', marginTop: 24 }}>
      <Card title="Hồ sơ của tôi">
        {profile.isPending ? <Skeleton active /> : profile.isError ? <QueryError error={profile.error} onRetry={profile.refetch} /> : (
          <Form key={`${profile.data.fullName}-${profile.data.phone}`} layout="vertical" initialValues={profile.data} onFinish={values => saveProfile.mutate({ fullName: values.fullName.trim(), phone: values.phone.replace(/[\s().-]/g, '') })} disabled={demo || saveProfile.isPending}>
            <Form.Item label="Email đăng nhập"><Input value={profile.data.email} disabled /></Form.Item>
            <Form.Item name="fullName" label="Họ và tên" rules={[{ required: true, whitespace: true, message: 'Nhập họ và tên.' }, { max: 150 }]}><Input autoComplete="name" /></Form.Item>
            <Form.Item name="phone" label="Số điện thoại" rules={phoneRules}><Input autoComplete="tel" /></Form.Item>
            {saveProfile.isError && <Alert type="error" showIcon title={saveProfile.error.message} style={{ marginBottom: 16 }} />}
            <Button type="primary" htmlType="submit" loading={saveProfile.isPending}>{label('Lưu hồ sơ')}</Button>
          </Form>
        )}
      </Card>
      <Card title="Sổ địa chỉ" extra={<Button onClick={() => edit('new')} disabled={demo || busy || !addresses.isSuccess}>{label('Thêm địa chỉ')}</Button>}>
        {addresses.isPending ? <Skeleton active /> : addresses.isError ? <QueryError error={addresses.error} onRetry={addresses.refetch} /> : (
          <Space orientation="vertical" style={{ width: '100%' }}>
            {!addresses.data.length && <Empty description="Bạn chưa lưu địa chỉ nào." />}
            {addresses.data.map(address => (
              <Card key={address.id} size="small" title={<>{address.recipientName} {address.isDefault && <Tag color="blue">Mặc định</Tag>}</>}>
                <p>{address.recipientPhone}</p><p>{address.addressLine}, {address.area}</p>
                <Space wrap>
                  <Button disabled={demo || busy} onClick={() => edit(address)}>{label('Sửa')}</Button>
                  {!address.isDefault && <Button disabled={demo || busy} onClick={() => makeDefault.mutate(address)}>{label('Đặt mặc định')}</Button>}
                  <Popconfirm title="Xóa địa chỉ này?" description="Đơn hàng đã đặt vẫn giữ nguyên địa chỉ giao." okText="Xóa" cancelText="Giữ lại" disabled={demo || busy} onConfirm={() => remove.mutate(address.id)}>
                    <Button danger disabled={demo || busy}>{label('Xóa')}</Button>
                  </Popconfirm>
                </Space>
              </Card>
            ))}
          </Space>
        )}
        {(remove.isError || makeDefault.isError) && <Alert type="error" showIcon title={remove.error?.message ?? makeDefault.error?.message} />}
      </Card>
      <Modal forceRender title={editing === 'new' ? 'Thêm địa chỉ' : 'Sửa địa chỉ'} open={editing !== null} onCancel={() => { if (!saveAddress.isPending) setEditing(null) }} onOk={() => addressForm.submit()} okText="Lưu địa chỉ" cancelText="Hủy" confirmLoading={saveAddress.isPending} cancelButtonProps={{ disabled: saveAddress.isPending }}>
        <Form form={addressForm} layout="vertical" onFinish={values => { if (!saveAddress.isPending) saveAddress.mutate(values) }} disabled={saveAddress.isPending}>
          <Form.Item name="recipientName" label="Tên người nhận" rules={[{ required: true, whitespace: true }, { max: 150 }]}><Input /></Form.Item>
          <Form.Item name="recipientPhone" label="Điện thoại người nhận" rules={phoneRules}><Input /></Form.Item>
          <Form.Item name="addressLine" label="Địa chỉ" rules={[{ required: true, whitespace: true }, { max: 255 }]}><TextArea rows={2} maxLength={255} /></Form.Item>
          <Form.Item name="area" label="Phường/Xã" rules={[{ required: true, whitespace: true, message: 'Chọn phường/xã.' }, { max: 150 }]}><WardSelect /></Form.Item>
          <Form.Item name="isDefault" valuePropName="checked"><Checkbox>Địa chỉ mặc định</Checkbox></Form.Item>
          {saveAddress.isError && <Alert type="error" showIcon title={saveAddress.error.message} />}
        </Form>
      </Modal>
    </Space>
  )
}
