import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Dropdown, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Tooltip } from 'antd'
import { Ellipsis, Pencil } from 'lucide-react'
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
  const { message, modal } = App.useApp()
  const client = useQueryClient()
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('active')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<BottleType | null | undefined>()
  const active = !admin || status === 'active' ? true : status === 'inactive' ? false : undefined
  const types = useQuery({ queryKey: ['live', 'bottle-types', admin, active], queryFn: () => bottleTypeApi.list(active) })
  const deactivate = useMutation({
    mutationFn: bottleTypeApi.deactivate,
    onSuccess: () => { void invalidateLiveData(client); message.success('Đã ngừng lưu hành loại vỏ.') },
    onError: (error: Error) => message.error(error.message),
  })
  const visible = (types.data ?? []).filter((type) => matchesSearch(search, type.name))
  const confirmStop = (item: BottleType) => modal.confirm({
    title: 'Ngừng lưu hành?',
    content: <div className="af-confirm-body"><p><strong>{item.name}</strong> sẽ không chọn được cho sản phẩm mới.</p><p>Sản phẩm, sổ vỏ và tiền cọc cũ vẫn giữ nguyên.</p></div>,
    centered: true,
    okText: 'Ngừng lưu hành',
    cancelText: 'Không',
    onOk: () => deactivate.mutateAsync(item.id).catch(() => undefined),
  })
  return <>
    <Modal open title="Loại vỏ bình" width={850} onCancel={onClose} footer={<Button onClick={onClose}>Đóng</Button>}>
      <Alert type="info" showIcon title="Quản lý loại vỏ và tiền cọc" description="Loại vỏ ngừng lưu hành vẫn giữ lịch sử nhưng không chọn được cho sản phẩm mới; lưu hành lại đang chờ backend hỗ trợ." style={{ marginBottom: 16 }} />
      <Space wrap style={{ marginBottom: 16 }}>
        <Input aria-label="Tìm loại vỏ" placeholder="Tìm tên loại vỏ" value={search} allowClear onChange={(event) => setSearch(event.target.value)} />
        {admin && <Select aria-label="Trạng thái loại vỏ" value={status} onChange={setStatus} options={[{ value: 'active', label: 'Đang lưu hành' }, { value: 'inactive', label: 'Ngừng lưu hành' }, { value: 'all', label: 'Tất cả' }]} />}
        <Button onClick={() => void types.refetch()} loading={types.isFetching}>Làm mới</Button>
        {admin && <Button type="primary" onClick={() => setEditing(null)}>Thêm loại vỏ</Button>}
      </Space>
      {types.isError ? <QueryError error={types.error} onRetry={types.refetch} /> : <Table<BottleType> key={`${status}:${search}`} rowKey="id" rowClassName={(item) => (item.active ? '' : 'af-row-inactive')} loading={types.isPending} dataSource={visible} pagination={{ pageSize: 10 }} scroll={{ x: 600 }} locale={{ emptyText: 'Không có loại vỏ phù hợp.' }} columns={[
        { title: 'Tên loại vỏ', dataIndex: 'name', render: (name: string, item: BottleType) => <span className="af-name-with-tag">{name}{!item.active && <Tag className="af-inactive-tag">Ngừng lưu hành</Tag>}</span> },
        { title: 'Tiền cọc / vỏ', dataIndex: 'depositUnitAmount', render: currency },
        ...(admin ? [{ title: 'Thao tác', key: 'actions', width: 100, render: (_: unknown, item: BottleType) => item.active ? <Space size={4}>
          <Tooltip title="Sửa tiền cọc"><Button size="small" icon={<Pencil size={15} />} aria-label={`Sửa tiền cọc ${item.name}`} disabled={deactivate.isPending} onClick={() => setEditing(item)} /></Tooltip>
          <Dropdown trigger={['click']} menu={{ items: [{ key: 'stop', label: 'Ngừng lưu hành', danger: true, disabled: deactivate.isPending, onClick: () => confirmStop(item) }] }}>
            <Button size="small" type="text" icon={<Ellipsis size={16} />} aria-label={`Thao tác khác với ${item.name}`} />
          </Dropdown>
        </Space> : (
          // BE chưa có API lưu hành lại; giữ chỗ để người dùng biết thao tác sẽ có.
          <Dropdown trigger={['click']} menu={{ items: [{ key: 'resume', label: 'Lưu hành lại', disabled: true, extra: 'Chưa hỗ trợ' }] }}>
            <Button size="small" type="text" icon={<Ellipsis size={16} />} aria-label={`Thao tác khác với ${item.name}`} />
          </Dropdown>
        ) }] : []),
      ]} />}
    </Modal>
    {editing !== undefined && <BottleTypeForm item={editing} onClose={() => setEditing(undefined)} />}
  </>
}
