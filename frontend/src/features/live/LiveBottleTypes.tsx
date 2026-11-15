import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Dropdown, Form, Input, InputNumber, Modal, Segmented, Space, Table, Tag, Tooltip } from 'antd'
import { Ellipsis, Pencil, Plus, Search } from 'lucide-react'
import { CountLabel } from '@/shared/components/CountLabel'
import { QueryError } from '@/shared/components/QueryError'
import { useConfirm } from '@/shared/components/confirm'
import { useConfirmDiscard } from '@/shared/hooks/useConfirmDiscard'
import { currency } from '@/shared/utils/format'
import { matchesSearch } from '@/shared/utils/search'
import { useStaff } from '@/features/auth/useStaff'
import { bottleTypeApi, type BottleType, type BottleTypeDraft } from './bottleTypeApi'
import { ApiError } from '@/shared/api/client'
import { invalidateLiveData } from './invalidateLiveData'
import { modalFixedBody, modalFixedWidth, modalWidth } from '@/shared/utils/modal'
import { modalTableScrollHeight } from '@/shared/utils/table'

function BottleTypeForm({ item, onClose }: { item: BottleType | null; onClose: () => void }) {
  const [form] = Form.useForm<BottleTypeDraft>()
  const cancel = useConfirmDiscard(form, onClose)
  const { message } = App.useApp()
  const client = useQueryClient()
  const save = useMutation({
    mutationFn: (draft: BottleTypeDraft) => (item ? bottleTypeApi.update(item.id, draft) : bottleTypeApi.create(draft)),
    onSuccess: () => {
      void invalidateLiveData(client)
      message.success(item ? 'Đã cập nhật loại vỏ.' : 'Đã thêm loại vỏ.')
      onClose()
    },
    // Trùng tên (409): nêu rõ tên vừa nhập trong ngoặc kép.
    onError: (error: Error, draft) =>
      message.error(error instanceof ApiError && error.status === 409 ? `Đã có loại vỏ "${draft.name.trim()}".` : error.message),
  })
  return (
    <Modal
      open
      title={item ? 'Sửa loại vỏ' : 'Thêm loại vỏ'}
      onCancel={() => {
        if (!save.isPending) cancel()
      }}
      onOk={() => form.submit()}
      okText="Lưu"
      cancelText="Hủy"
      width={modalWidth.small}
      confirmLoading={save.isPending}
      closable={!save.isPending}
      cancelButtonProps={{ disabled: save.isPending }}
    >
      <Form
        form={form}
        name="bottle-type"
        layout="vertical"
        initialValues={item ?? { name: '', depositUnitAmount: 0 }}
        onFinish={(draft) => {
          if (!save.isPending) save.mutate(draft)
        }}
        disabled={save.isPending}
      >
        <Form.Item
          name="name"
          label="Tên loại vỏ"
          rules={[
            { required: true, whitespace: true, message: 'Nhập tên loại vỏ.' },
            { max: 100, message: 'Tên tối đa 100 ký tự.' },
          ]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="depositUnitAmount"
          label="Tiền cọc / vỏ (₫)"
          rules={[
            { required: true, message: 'Nhập tiền cọc.' },
            { type: 'number', min: 0, max: 999999999999, message: 'Tiền cọc từ 0 đến 999.999.999.999 ₫.' },
          ]}
        >
          <InputNumber min={0} max={999999999999} precision={0} style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export function LiveBottleTypes({ onClose }: { onClose: () => void }) {
  const role = useStaff()?.role
  const admin = role === 'ADMIN' || role === 'SALES_STAFF'
  const { message, modal } = App.useApp()
  const ask = useConfirm()
  const client = useQueryClient()
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('active')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<BottleType | null | undefined>()
  // Quản trị tải hết một lần rồi lọc tại chỗ để đếm được từng trạng thái; vai trò khác chỉ thấy loại đang lưu hành.
  const types = useQuery({ queryKey: ['live', 'bottle-types', admin], queryFn: () => bottleTypeApi.list(admin ? undefined : true) })
  const allTypes = types.data ?? []
  const activeCount = allTypes.filter((type) => type.active).length
  const deactivate = useMutation({
    mutationFn: bottleTypeApi.deactivate,
    onSuccess: () => {
      void invalidateLiveData(client)
      message.success('Đã ngừng lưu hành loại vỏ.')
    },
    onError: (error: Error) => message.error(error.message),
  })
  const reactivate = useMutation({
    mutationFn: bottleTypeApi.reactivate,
    onSuccess: (item) => {
      void invalidateLiveData(client)
      message.success(`Đã lưu hành lại ${item.name}.`)
    },
    onError: (error: Error) => message.error(error.message),
  })
  const visible = allTypes.filter((type) => (status === 'all' || type.active === (status === 'active')) && matchesSearch(search, type.name))
  const confirmStop = (item: BottleType) =>
    modal.confirm({
      title: 'Ngừng lưu hành?',
      content: (
        <div className="af-confirm-body">
          <p>
            <strong>{item.name}</strong> sẽ không chọn được cho sản phẩm mới.
          </p>
          <p>Sản phẩm, sổ vỏ và tiền cọc cũ vẫn giữ nguyên.</p>
        </div>
      ),
      centered: true,
      okText: 'Ngừng lưu hành',
      okButtonProps: { danger: true },
      cancelText: 'Không',
      onOk: () => deactivate.mutateAsync(item.id).catch(() => undefined),
    })
  return (
    <>
      <Modal open centered title="Loại vỏ bình" width={modalFixedWidth} styles={modalFixedBody} onCancel={onClose} footer={null}>
        <div className="af-modal-toolbar">
          <Input
            aria-label="Tìm loại vỏ"
            prefix={<Search size={16} className="af-input-icon" />}
            placeholder="Tìm tên loại vỏ"
            value={search}
            allowClear
            onChange={(event) => setSearch(event.target.value)}
          />
          {admin && (
            <Segmented<'active' | 'inactive' | 'all'>
              aria-label="Trạng thái loại vỏ"
              value={status}
              onChange={setStatus}
              options={[
                { value: 'active', label: <CountLabel label="Đang lưu hành" count={activeCount} tone="success" /> },
                { value: 'inactive', label: <CountLabel label="Ngừng lưu hành" count={allTypes.length - activeCount} tone="danger" /> },
                { value: 'all', label: <CountLabel label="Tất cả" count={allTypes.length} /> },
              ]}
            />
          )}
          {admin && (
            <Button className="af-modal-toolbar-end" type="primary" icon={<Plus size={16} />} onClick={() => setEditing(null)}>
              Thêm loại vỏ
            </Button>
          )}
        </div>
        {types.isError ? (
          <QueryError error={types.error} onRetry={types.refetch} />
        ) : (
          <Table<BottleType>
            key={`${status}:${search}`}
            rowKey="id"
            className="af-modal-table af-modal-table-fixed"
            rowClassName={(item) => (item.active ? '' : 'af-row-inactive')}
            loading={types.isPending}
            dataSource={visible}
            size="small"
            pagination={false}
            scroll={{ x: 600, y: modalTableScrollHeight }}
            locale={{ emptyText: 'Không có loại vỏ phù hợp.' }}
            columns={[
              {
                title: 'Tên loại vỏ',
                dataIndex: 'name',
                render: (name: string, item: BottleType) => (
                  <span className="af-name-with-tag">
                    {name}
                    {!item.active && <Tag className="af-inactive-tag">Ngừng lưu hành</Tag>}
                  </span>
                ),
              },
              { title: 'Tiền cọc / vỏ', dataIndex: 'depositUnitAmount', render: currency },
              ...(admin
                ? [
                    {
                      title: 'Thao tác',
                      key: 'actions',
                      width: 100,
                      render: (_: unknown, item: BottleType) =>
                        item.active ? (
                          <Space size={4}>
                            <Tooltip title="Sửa">
                              <Button
                                size="small"
                                icon={<Pencil size={15} />}
                                aria-label={`Sửa ${item.name}`}
                                disabled={deactivate.isPending}
                                onClick={() => setEditing(item)}
                              />
                            </Tooltip>
                            <Dropdown
                              trigger={['click']}
                              menu={{
                                items: [
                                  {
                                    key: 'stop',
                                    label: 'Ngừng lưu hành',
                                    danger: true,
                                    disabled: deactivate.isPending,
                                    onClick: () => confirmStop(item),
                                  },
                                ],
                              }}
                            >
                              <Button
                                size="small"
                                type="text"
                                icon={<Ellipsis size={16} />}
                                aria-label={`Thao tác khác với ${item.name}`}
                              />
                            </Dropdown>
                          </Space>
                        ) : (
                          <Dropdown
                            trigger={['click']}
                            menu={{
                              items: [
                                {
                                  key: 'resume',
                                  label: 'Lưu hành lại',
                                  disabled: reactivate.isPending,
                                  onClick: async () => {
                                    if (
                                      await ask({
                                        title: `Lưu hành lại vỏ ${item.name}?`,
                                        content: <p>Loại vỏ này dùng lại được cho sản phẩm và sổ vỏ.</p>,
                                        okText: 'Lưu hành lại',
                                      })
                                    )
                                      reactivate.mutate(item.id)
                                  },
                                },
                              ],
                            }}
                          >
                            <Button size="small" type="text" icon={<Ellipsis size={16} />} aria-label={`Thao tác khác với ${item.name}`} />
                          </Dropdown>
                        ),
                    },
                  ]
                : []),
            ]}
          />
        )}
      </Modal>
      {editing !== undefined && <BottleTypeForm item={editing} onClose={() => setEditing(undefined)} />}
    </>
  )
}
