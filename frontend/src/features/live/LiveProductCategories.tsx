import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Dropdown, Form, Input, Modal, Segmented, Space, Table, Tag, Tooltip } from 'antd'
import { Ellipsis, Pencil, Plus } from 'lucide-react'
import { CountLabel } from '@/shared/components/CountLabel'
import { QueryError } from '@/shared/components/QueryError'
import { useConfirmDiscard } from '@/shared/hooks/useConfirmDiscard'
import { matchesSearch } from '@/shared/utils/search'
import { modalWidth } from '@/shared/utils/modal'
import { useProductCategories } from '@/features/inventory/useProductCatalog'
import { productCategoryApi, type ProductCategory } from './productCategoryApi'
import { invalidateLiveData } from './invalidateLiveData'

type Status = 'active' | 'inactive' | 'all'

function CategoryForm({ item, onClose }: { item: ProductCategory | null; onClose: () => void }) {
  const [form] = Form.useForm<{ name: string }>()
  const cancel = useConfirmDiscard(form, onClose)
  const { message } = App.useApp()
  const client = useQueryClient()
  const save = useMutation({
    mutationFn: ({ name }: { name: string }) => (item ? productCategoryApi.update(item.id, { name }) : productCategoryApi.create(name)),
    onSuccess: (saved) => {
      void invalidateLiveData(client)
      message.success(item ? `Đã đổi tên thành ${saved.name}.` : `Đã thêm loại ${saved.name}.`)
      onClose()
    },
    onError: (error: Error) => message.error(error.message),
  })
  return (
    <Modal
      open
      title={item ? 'Đổi tên loại sản phẩm' : 'Thêm loại sản phẩm'}
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
        name="product-category"
        layout="vertical"
        initialValues={{ name: item?.name ?? '' }}
        onFinish={(values) => {
          if (!save.isPending) save.mutate(values)
        }}
        disabled={save.isPending}
      >
        <Form.Item
          name="name"
          label="Tên loại"
          rules={[
            { required: true, whitespace: true, message: 'Nhập tên loại sản phẩm.' },
            { max: 80, message: 'Tên tối đa 80 ký tự.' },
          ]}
          extra={item && item.productCount > 0 ? `${item.productCount} sản phẩm thuộc loại này sẽ hiện tên mới.` : undefined}
        >
          <Input autoFocus placeholder="Ví dụ: Nước khoáng" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

/** Thêm, đổi tên, ngừng dùng / dùng lại và xóa (khi chưa có sản phẩm) loại sản phẩm. */
export function LiveProductCategories({ onClose }: { onClose: () => void }) {
  const { message, modal } = App.useApp()
  const client = useQueryClient()
  const [status, setStatus] = useState<Status>('active')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<ProductCategory | null | undefined>()
  const categories = useProductCategories()
  const all = categories.data ?? []
  const activeCount = all.filter((item) => item.active).length
  const done = (text: string) => {
    void invalidateLiveData(client)
    message.success(text)
  }
  const setActive = useMutation({
    mutationFn: (item: ProductCategory) => productCategoryApi.update(item.id, { name: item.name, active: !item.active }),
    onSuccess: (item) => done(item.active ? `Đã dùng lại loại ${item.name}.` : `Đã ngừng dùng loại ${item.name}.`),
    onError: (error: Error) => message.error(error.message),
  })
  const remove = useMutation({
    mutationFn: (item: ProductCategory) => productCategoryApi.remove(item.id).then(() => item),
    onSuccess: (item) => done(`Đã xóa loại ${item.name}.`),
    onError: (error: Error) => message.error(error.message),
  })
  const busy = setActive.isPending || remove.isPending
  const visible = all.filter((item) => (status === 'all' || item.active === (status === 'active')) && matchesSearch(search, item.name))

  const confirmStop = (item: ProductCategory) =>
    modal.confirm({
      title: 'Ngừng dùng loại này?',
      content: (
        <div className="af-confirm-body">
          <p>
            <strong>{item.name}</strong> sẽ không chọn được cho sản phẩm khác.
          </p>
          {item.productCount > 0 && <p>{item.productCount} sản phẩm đang thuộc loại này vẫn giữ nguyên.</p>}
        </div>
      ),
      centered: true,
      okText: 'Ngừng dùng',
      okButtonProps: { danger: true },
      cancelText: 'Không',
      onOk: () => setActive.mutateAsync(item).catch(() => undefined),
    })
  const confirmDelete = (item: ProductCategory) =>
    modal.confirm({
      title: `Xóa loại ${item.name}?`,
      content: 'Loại này chưa có sản phẩm nào. Xóa xong không khôi phục được.',
      centered: true,
      okText: 'Xóa',
      okButtonProps: { danger: true },
      cancelText: 'Không',
      onOk: () => remove.mutateAsync(item).catch(() => undefined),
    })

  return (
    <>
      <Modal open title="Loại sản phẩm" width={modalWidth.large} onCancel={onClose} footer={<Button onClick={onClose}>Đóng</Button>}>
        <Alert
          type="info"
          showIcon
          title="Dùng để phân loại và lọc ở trang Sản phẩm và trang mua hàng"
          description="Loại ngừng dùng vẫn giữ trên sản phẩm cũ nhưng không chọn được cho sản phẩm khác. Chỉ xóa được loại chưa có sản phẩm nào."
          style={{ marginBottom: 16 }}
        />
        <Space wrap style={{ marginBottom: 16 }}>
          <Input
            aria-label="Tìm loại sản phẩm"
            placeholder="Tìm tên loại"
            value={search}
            allowClear
            onChange={(event) => setSearch(event.target.value)}
          />
          <Segmented<Status>
            aria-label="Trạng thái loại sản phẩm"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'active', label: <CountLabel label="Đang dùng" count={activeCount} tone="success" /> },
              { value: 'inactive', label: <CountLabel label="Ngừng dùng" count={all.length - activeCount} tone="danger" /> },
              { value: 'all', label: <CountLabel label="Tất cả" count={all.length} /> },
            ]}
          />
          <Button type="primary" icon={<Plus size={16} />} onClick={() => setEditing(null)}>
            Thêm loại
          </Button>
        </Space>
        {categories.isError ? (
          <QueryError error={categories.error} onRetry={categories.refetch} />
        ) : (
          <Table<ProductCategory>
            key={`${status}:${search}`}
            rowKey="id"
            rowClassName={(item) => (item.active ? '' : 'af-row-inactive')}
            loading={categories.isPending}
            dataSource={visible}
            pagination={{ pageSize: 10 }}
            locale={{ emptyText: 'Không có loại sản phẩm phù hợp.' }}
            columns={[
              {
                title: 'Tên loại',
                dataIndex: 'name',
                render: (name: string, item) => (
                  <span className="af-name-with-tag">
                    {name}
                    {!item.active && <Tag className="af-inactive-tag">Ngừng dùng</Tag>}
                  </span>
                ),
              },
              { title: 'Số sản phẩm', dataIndex: 'productCount', width: 130, align: 'right' },
              {
                title: 'Thao tác',
                key: 'actions',
                width: 112,
                align: 'center',
                render: (_, item) => (
                  <Space size={4}>
                    <Tooltip title="Đổi tên">
                      <Button
                        size="small"
                        icon={<Pencil size={15} />}
                        aria-label={`Đổi tên ${item.name}`}
                        disabled={busy}
                        onClick={() => setEditing(item)}
                      />
                    </Tooltip>
                    <Dropdown
                      trigger={['click']}
                      menu={{
                        items: [
                          item.active
                            ? { key: 'stop', label: 'Ngừng dùng', disabled: busy, onClick: () => confirmStop(item) }
                            : { key: 'resume', label: 'Dùng lại', disabled: busy, onClick: () => setActive.mutate(item) },
                          {
                            key: 'delete',
                            danger: true,
                            disabled: busy || item.productCount > 0,
                            label: item.productCount > 0 ? `Xóa (còn ${item.productCount} sản phẩm)` : 'Xóa',
                            onClick: () => confirmDelete(item),
                          },
                        ],
                      }}
                    >
                      <Button size="small" type="text" icon={<Ellipsis size={16} />} aria-label={`Thao tác khác với ${item.name}`} />
                    </Dropdown>
                  </Space>
                ),
              },
            ]}
          />
        )}
      </Modal>
      {editing !== undefined && <CategoryForm item={editing} onClose={() => setEditing(undefined)} />}
    </>
  )
}
