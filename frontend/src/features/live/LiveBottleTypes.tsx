import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag } from 'antd'
import { QueryError } from '../../shared/components/QueryError'
import { useConfirmDiscard } from '../../shared/hooks/useConfirmDiscard'
import { currency } from '../../shared/utils/format'
import { matchesSearch } from '../../shared/utils/search'
import { useStaff } from '../auth/useStaff'
import { bottleTypeApi, type BottleType, type BottleTypeDraft } from './bottleTypeApi'
import { invalidateLiveData } from './invalidateLiveData'

function BottleTypeForm({ item, onClose }: { item: BottleType | null; onClose: () => void }) {
  const [form] = Form.useForm<BottleTypeDraft>()
  const cancel = useConfirmDiscard(form, onClose)
  const { message } = App.useApp()
  const client = useQueryClient()
  const save = useMutation({
    mutationFn: (draft: BottleTypeDraft) => item ? bottleTypeApi.update(item.id, draft.depositUnitAmount) : bottleTypeApi.create(draft),
    onSuccess: () => { void invalidateLiveData(client); message.success(item ? 'Đã cập nhật tiền cọc.' : 'Đã thêm loại vỏ.'); onClose() },
    onError: (error: Error) => message.error(error.message),
  })
  return <Modal open title={item ? 'Sửa tiền cọc loại vỏ' : 'Thêm loại vỏ'} onCancel={() => { if (!save.isPending) cancel() }} onOk={() => form.submit()} okText="Lưu" cancelText="Hủy" confirmLoading={save.isPending} closable={!save.isPending} cancelButtonProps={{ disabled: save.isPending }}>
    <Form form={form} name="bottle-type" layout="vertical" initialValues={item ?? { name: '', depositUnitAmount: 0 }} onFinish={(draft) => { if (!save.isPending) save.mutate(draft) }} disabled={save.isPending}>
      <Form.Item name="name" label="Tên loại vỏ" rules={[{ required: true, whitespace: true, message: 'Nhập tên loại vỏ.' }, { max: 100, message: 'Tên tối đa 100 ký tự.' }]} extra={item ? 'Tên loại vỏ được giữ cố định sau khi tạo.' : undefined}><Input disabled={!!item} /></Form.Item>
      <Form.Item name="depositUnitAmount" label="Tiền cọc / vỏ (₫)" rules={[{ required: true, message: 'Nhập tiền cọc.' }, { type: 'number', min: 0, max: 999999999999.99, message: 'Tiền cọc từ 0 đến 999.999.999.999,99 ₫.' }]}><InputNumber min={0} max={999999999999.99} precision={2} style={{ width: '100%' }} /></Form.Item>
    </Form>
  </Modal>
}

export function LiveBottleTypes({ onClose }: { onClose: () => void }) {
  const admin = useStaff()?.role === 'ADMIN'
  const { message } = App.useApp()
  const client = useQueryClient()
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('active')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<BottleType | null | undefined>()
  const active = !admin || status === 'active' ? true : status === 'inactive' ? false : undefined
  const types = useQuery({ queryKey: ['live', 'bottle-types', admin, active], queryFn: () => bottleTypeApi.list(active) })
  const deactivate = useMutation({
    mutationFn: bottleTypeApi.deactivate,
    onSuccess: () => { void invalidateLiveData(client); message.success('Đã ngừng dùng loại vỏ.') },
    onError: (error: Error) => message.error(error.message),
  })
  const visible = (types.data ?? []).filter((type) => matchesSearch(search, type.name))
  return <>
    <Modal open title="Loại vỏ bình" width={850} onCancel={onClose} footer={<Button onClick={onClose}>Đóng</Button>}>
      <Alert type="info" showIcon title="Quản lý loại vỏ và tiền cọc" description="Ngừng dùng sẽ giữ lại lịch sử. Loại vỏ đã ngừng dùng không xuất hiện trong danh sách chọn cho sản phẩm mới; hiện chưa hỗ trợ kích hoạt lại." style={{ marginBottom: 16 }} />
      <Space wrap style={{ marginBottom: 16 }}>
        <Input aria-label="Tìm loại vỏ" placeholder="Tìm tên loại vỏ" value={search} allowClear onChange={(event) => setSearch(event.target.value)} />
        {admin && <Select aria-label="Trạng thái loại vỏ" value={status} onChange={setStatus} options={[{ value: 'active', label: 'Đang dùng' }, { value: 'inactive', label: 'Đã ngừng dùng' }, { value: 'all', label: 'Tất cả' }]} />}
        <Button onClick={() => void types.refetch()} loading={types.isFetching}>Làm mới</Button>
        {admin && <Button type="primary" onClick={() => setEditing(null)}>Thêm loại vỏ</Button>}
      </Space>
      {types.isError ? <QueryError error={types.error} onRetry={types.refetch} /> : <Table<BottleType> key={`${status}:${search}`} rowKey="id" loading={types.isPending} dataSource={visible} pagination={{ pageSize: 10 }} scroll={{ x: 600 }} locale={{ emptyText: 'Không có loại vỏ phù hợp.' }} columns={[
        { title: 'Tên loại vỏ', dataIndex: 'name' },
        { title: 'Tiền cọc / vỏ', dataIndex: 'depositUnitAmount', render: currency },
        { title: 'Trạng thái', dataIndex: 'active', render: (value: boolean) => <Tag color={value ? 'green' : 'default'}>{value ? 'Đang dùng' : 'Đã ngừng dùng'}</Tag> },
        ...(admin ? [{ title: 'Thao tác', key: 'actions', render: (_: unknown, item: BottleType) => item.active ? <Space>
          <Button type="link" disabled={deactivate.isPending} onClick={() => setEditing(item)}>Sửa tiền cọc</Button>
          <Popconfirm title={`Ngừng dùng ${item.name}?`} description="Loại vỏ vẫn được giữ trong lịch sử." okText="Ngừng dùng" cancelText="Hủy" onConfirm={() => deactivate.mutateAsync(item.id).catch(() => undefined)}><Button danger type="link" disabled={deactivate.isPending}>Ngừng dùng</Button></Popconfirm>
        </Space> : '—' }] : []),
      ]} />}
    </Modal>
    {editing !== undefined && <BottleTypeForm item={editing} onClose={() => setEditing(undefined)} />}
  </>
}
