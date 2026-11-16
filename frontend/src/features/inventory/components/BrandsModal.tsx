import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Form, Input, Modal, Popconfirm, Select, Table, Tooltip } from 'antd'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { modalFixedBody, modalFixedWidth, modalWidth } from '@/shared/utils/modal'
import { modalTableScrollHeight } from '@/shared/utils/table'
import { QueryError } from '@/shared/components/QueryError'
import { normalizeSearch } from '../catalogGroups'
import { brandRows } from '../brandRows'
import { brandApi, brandsKey, useBrands, useCanManageBrands, type Brand, type BrandInput } from '../brandApi'
import type { CatalogItem } from '../useProductCatalog'

type Row = { id?: number; name: string; aliases: string[]; logo?: string | null; count: number }

/**
 * Quản lý thương hiệu (lưu ở backend). Sản phẩm vẫn ghi chữ thương hiệu; backend tự nối sản phẩm với thương hiệu
 * khi chữ đó trùng tên hoặc một tên gọi khác. Chỉ chủ cửa hàng thêm/sửa/xóa.
 */
export function BrandsModal({ products, onClose }: { products: Pick<CatalogItem, 'brand'>[]; onClose: () => void }) {
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Brand | 'new' | null>(null)
  const brands = useBrands()
  const canManage = useCanManageBrands()
  const client = useQueryClient()
  const { message } = App.useApp()
  const keyword = normalizeSearch(search.trim())
  // Backend chưa trả được danh sách thì vẫn hiện thương hiệu suy ra từ sản phẩm, chỉ để xem.
  const source: Row[] = brands.data
    ? brands.data.map((brand) => ({ ...brand, count: brand.productCount }))
    : brandRows(products)
  const rows = source.filter((row) => normalizeSearch(`${row.name} ${row.aliases.join(' ')}`).includes(keyword))
  const remove = useMutation({
    mutationFn: brandApi.remove,
    onSuccess: async () => {
      message.success('Đã xóa thương hiệu.')
      await client.invalidateQueries({ queryKey: brandsKey })
    },
  })
  const editable = canManage && !!brands.data
  return (
    <Modal open centered title="Thương hiệu" width={modalFixedWidth} styles={modalFixedBody} onCancel={onClose} footer={null}>
      <div className="af-modal-toolbar">
        <Input
          aria-label="Tìm thương hiệu"
          prefix={<Search size={16} className="af-input-icon" />}
          placeholder="Tìm tên thương hiệu"
          value={search}
          allowClear
          onChange={(event) => setSearch(event.target.value)}
        />
        {canManage && (
          <Button
            className="af-modal-toolbar-end"
            type="primary"
            icon={<Plus size={16} />}
            disabled={!brands.data}
            onClick={() => setEditing('new')}
          >
            Thêm thương hiệu
          </Button>
        )}
      </div>
      {brands.isError && <QueryError error={brands.error} onRetry={brands.refetch} />}
      {remove.isError && <Alert type="error" showIcon title={remove.error.message} style={{ marginBottom: 12 }} />}
      <Table<Row>
        rowKey={(row) => row.id ?? row.name}
        className="af-modal-table af-modal-table-fixed"
        dataSource={rows}
        loading={brands.isPending && !brands.isError}
        size="small"
        pagination={false}
        scroll={{ y: modalTableScrollHeight }}
        locale={{ emptyText: 'Không có thương hiệu phù hợp.' }}
        columns={[
          {
            title: 'Thương hiệu',
            dataIndex: 'name',
            render: (name: string, row) => (
              <span className="af-brand-cell">
                {row.logo ? <img src={row.logo} alt="" /> : <span className="af-brand-cell-empty" aria-hidden />}
                {name}
              </span>
            ),
          },
          {
            title: 'Tên gọi khác',
            dataIndex: 'aliases',
            render: (aliases: string[], row) =>
              aliases.filter((alias) => alias !== row.name.toLowerCase()).join(', ') || <span className="af-text-muted">—</span>,
          },
          { title: 'Số sản phẩm', dataIndex: 'count', width: 120, align: 'right' },
          ...(editable
            ? [
                {
                  title: 'Thao tác',
                  key: 'actions',
                  width: 110,
                  align: 'center' as const,
                  render: (_: unknown, row: Row) => {
                    const brand = brands.data?.find((item) => item.id === row.id)
                    return (
                      <span className="af-row-actions">
                        <Button size="small" icon={<Pencil size={15} />} aria-label={`Sửa ${row.name}`} onClick={() => brand && setEditing(brand)} />
                        {row.count > 0 ? (
                          <Tooltip title="Đang có sản phẩm thuộc thương hiệu này, không xóa được.">
                            <Button size="small" danger icon={<Trash2 size={15} />} aria-label={`Xóa ${row.name}`} disabled />
                          </Tooltip>
                        ) : (
                          <Popconfirm
                            title={`Xóa thương hiệu ${row.name}?`}
                            okText="Xóa"
                            cancelText="Giữ lại"
                            okButtonProps={{ danger: true }}
                            onConfirm={() => row.id && remove.mutateAsync(row.id)}
                          >
                            <Button size="small" danger icon={<Trash2 size={15} />} aria-label={`Xóa ${row.name}`} />
                          </Popconfirm>
                        )}
                      </span>
                    )
                  },
                },
              ]
            : []),
        ]}
      />
      {editing && <BrandForm brand={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </Modal>
  )
}

function BrandForm({ brand, onClose }: { brand?: Brand; onClose: () => void }) {
  const [form] = Form.useForm<BrandInput>()
  const client = useQueryClient()
  const { message } = App.useApp()
  const save = useMutation({
    mutationFn: (values: BrandInput) => {
      const input = {
        name: values.name.trim(),
        aliases: (values.aliases ?? []).map((alias) => alias.trim()).filter(Boolean),
        logo: values.logo?.trim() || null,
      }
      return brand ? brandApi.update(brand.id, input) : brandApi.create(input)
    },
    onSuccess: async () => {
      message.success(brand ? 'Đã lưu thương hiệu.' : 'Đã thêm thương hiệu.')
      await Promise.all([client.invalidateQueries({ queryKey: brandsKey }), client.invalidateQueries({ queryKey: ['live', 'products'] })])
      onClose()
    },
  })
  return (
    <Modal
      open
      centered
      title={brand ? `Sửa ${brand.name}` : 'Thêm thương hiệu'}
      width={modalWidth.small}
      onCancel={() => !save.isPending && onClose()}
      onOk={() => form.submit()}
      okText="Lưu"
      cancelText="Hủy"
      confirmLoading={save.isPending}
    >
      <Form
        form={form}
        layout="vertical"
        disabled={save.isPending}
        initialValues={{
          name: brand?.name ?? '',
          aliases: (brand?.aliases ?? []).filter((alias) => alias !== brand?.name.toLowerCase()),
          logo: brand?.logo ?? '',
        }}
        onFinish={(values) => save.mutate(values)}
      >
        <Form.Item name="name" label="Tên thương hiệu" rules={[{ required: true, whitespace: true, message: 'Nhập tên thương hiệu.' }, { max: 150 }]}>
          <Input />
        </Form.Item>
        <Form.Item
          name="aliases"
          label="Tên gọi khác"
          extra="Sản phẩm ghi thương hiệu trùng tên hoặc một tên gọi khác sẽ được gom vào thương hiệu này. Đổi tên thì tên cũ được giữ làm tên gọi khác."
        >
          <Select mode="tags" tokenSeparators={[',']} open={false} placeholder="Gõ rồi nhấn Enter, ví dụ: lavie, viva" />
        </Form.Item>
        <Form.Item
          name="logo"
          label="Logo"
          rules={[{ max: 500 }, { pattern: /^(\/|https?:\/\/)/, message: 'Đường dẫn bắt đầu bằng / hoặc http(s)://' }]}
        >
          <Input placeholder="/images/brands/ten-thuong-hieu.png" />
        </Form.Item>
        {save.isError && <Alert type="error" showIcon title={save.error.message} />}
      </Form>
    </Modal>
  )
}
