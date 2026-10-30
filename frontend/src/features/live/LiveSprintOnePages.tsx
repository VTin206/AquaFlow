import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag } from 'antd'
import { api } from '../../shared/api/client'
import { Page } from '../../shared/components/Page'
import { QueryError } from '../../shared/components/QueryError'
import { useStaff } from '../auth/useStaff'
import { LiveBottleTypes } from './LiveBottleTypes'
import { bottleTypeApi } from './bottleTypeApi'
import { invalidateLiveData } from './invalidateLiveData'
import { matchesSearch } from '../../shared/utils/search'

type ProductDto = {
  id: number; sku: string; name: string; brand: string | null; unit: string
  unitsPerCase: number | null; bottleTypeId: number | null; salePrice: number; active: boolean
}
type ProductDraft = Omit<ProductDto, 'id' | 'active'>
type CatalogFilter = 'active' | 'inactive' | 'all'
const filterOptions = [{ value: 'active', label: 'Đang hoạt động' }, { value: 'inactive', label: 'Đã ngừng dùng' }, { value: 'all', label: 'Tất cả' }]
const activeQuery = (filter: CatalogFilter) => filter === 'all' ? '' : `?active=${filter === 'active'}`


export function LiveProductsPage() {
  const { message } = App.useApp()
  const staff = useStaff()
  const admin = staff?.role === 'ADMIN'
  const queryClient = useQueryClient()
  const [form] = Form.useForm<ProductDraft>()
  const [editing, setEditing] = useState<ProductDto | null | undefined>()
  const [bottlesOpen, setBottlesOpen] = useState(false)
  const [filter, setFilter] = useState<CatalogFilter>('active')
  const [search, setSearch] = useState('')
  const effectiveFilter = admin ? filter : 'active'
  const products = useQuery({ queryKey: ['live', 'products', effectiveFilter], queryFn: () => api.get<ProductDto[]>(`/products${activeQuery(effectiveFilter)}`) })
  const bottleTypes = useQuery({ queryKey: ['live', 'bottle-types', admin, admin ? undefined : true], queryFn: () => bottleTypeApi.list(admin ? undefined : true) })
  const save = useMutation({
    mutationFn: (draft: ProductDraft) => {
      const input = { ...draft, sku: draft.sku?.trim(), name: draft.name.trim(), brand: draft.brand?.trim() || null, bottleTypeId: draft.bottleTypeId ?? null, unitsPerCase: draft.unitsPerCase ?? null }
      if (editing) {
        const { sku: _sku, ...update } = input
        void _sku
        return api.put<ProductDto>(`/products/${editing.id}`, update)
      }
      return api.post<ProductDto>('/products', input)
    },
    onSuccess: () => { void invalidateLiveData(queryClient); setEditing(undefined); message.success('Đã lưu sản phẩm.') },
    onError: (error: Error) => message.error(error.message),
  })
  const deactivate = useMutation({
    mutationFn: (id: number) => api.delete<void>(`/products/${id}`),
    onSuccess: () => { void invalidateLiveData(queryClient); message.success('Đã ngừng kinh doanh sản phẩm.') },
    onError: (error: Error) => message.error(error.message),
  })
  const open = (product: ProductDto | null) => {
    setEditing(product)
    form.setFieldsValue(product ?? { sku: '', name: '', brand: null, unit: 'Bình', unitsPerCase: null, bottleTypeId: null, salePrice: 0 })
  }

  return <Page title="Sản phẩm" description="Danh mục sản phẩm và loại vỏ bình." actions={<Space wrap><Button onClick={() => setBottlesOpen(true)}>Loại vỏ bình</Button>{admin && <Button type="primary" onClick={() => open(null)}>Thêm sản phẩm</Button>}</Space>}>
    <Alert type="info" showIcon title="Tồn kho và hạn sử dụng chưa có API Sprint 1; trang này chỉ hiển thị danh mục và giá bán." style={{ marginBottom: 16 }} />
    <Space wrap style={{ marginBottom: 16 }}>
      <Input aria-label="Tìm sản phẩm" placeholder="Tìm mã, tên, thương hiệu" allowClear value={search} onChange={(event) => setSearch(event.target.value)} />
      {admin && <Select aria-label="Trạng thái sản phẩm" value={filter} onChange={setFilter} options={filterOptions} />}
      <Button loading={products.isFetching} onClick={() => void products.refetch()}>Làm mới</Button>
    </Space>
    {products.isError ? <QueryError error={products.error} onRetry={products.refetch} /> : <Table<ProductDto> key={`${effectiveFilter}:${search}`} rowKey="id" loading={products.isPending} dataSource={(products.data ?? []).filter((item) => matchesSearch(search, `${item.sku} ${item.name} ${item.brand ?? ''}`))} pagination={{ pageSize: 12 }} scroll={{ x: 850 }} columns={[
      { title: 'Mã', dataIndex: 'sku' }, { title: 'Tên sản phẩm', dataIndex: 'name' }, { title: 'Thương hiệu', dataIndex: 'brand', render: (v: string | null) => v || '—' },
      { title: 'Đơn vị', dataIndex: 'unit' }, { title: 'Giá bán', dataIndex: 'salePrice', render: (v: number) => `${Number(v).toLocaleString('vi-VN')} ₫` },
      { title: 'Trạng thái', dataIndex: 'active', render: (value: boolean) => <Tag color={value ? 'green' : 'default'}>{value ? 'Đang bán' : 'Đã ngừng bán'}</Tag> },
      ...(admin ? [{ title: 'Thao tác', key: 'actions', render: (_: unknown, item: ProductDto) => <><Button type="link" onClick={() => open(item)}>Sửa</Button>{item.active && <Popconfirm title="Ngừng kinh doanh sản phẩm?" onConfirm={() => deactivate.mutateAsync(item.id).catch(() => undefined)}><Button type="link" danger disabled={deactivate.isPending}>Ngừng bán</Button></Popconfirm>}</> }] : []),
    ]} />}
    <Modal title={editing ? 'Sửa sản phẩm' : 'Thêm sản phẩm'} open={editing !== undefined} onCancel={() => setEditing(undefined)} onOk={() => form.submit()} confirmLoading={save.isPending} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={(draft) => save.mutate(draft)}>
        <Form.Item label="SKU" name="sku" rules={[{ required: true, max: 64 }]}><Input disabled={!!editing} /></Form.Item>
        <Form.Item label="Tên" name="name" rules={[{ required: true, max: 200 }]}><Input /></Form.Item>
        <Form.Item label="Thương hiệu" name="brand" rules={[{ max: 150 }]}><Input /></Form.Item>
        <Form.Item label="Đơn vị" name="unit" rules={[{ required: true, max: 40 }]}><Input /></Form.Item>
        <Form.Item label="Số đơn vị/thùng" name="unitsPerCase"><InputNumber min={1} precision={0} style={{ width: '100%' }} /></Form.Item>
        {bottleTypes.isError && <Alert type="warning" title="Không tải được loại vỏ." action={<Button onClick={() => void bottleTypes.refetch()}>Thử lại</Button>} />}
        <Form.Item label="Loại vỏ" name="bottleTypeId"><Select allowClear loading={bottleTypes.isPending} options={(bottleTypes.data ?? []).filter((x) => x.active || x.id === editing?.bottleTypeId).map((x) => ({ value: x.id, label: `${x.name}${x.active ? '' : ' (đã ngừng dùng)'}`, disabled: !x.active }))} /></Form.Item>
        <Form.Item label="Giá bán" name="salePrice" rules={[{ required: true }]}><InputNumber min={0} precision={2} style={{ width: '100%' }} /></Form.Item>
      </Form>
    </Modal>
    {bottlesOpen && <LiveBottleTypes onClose={() => setBottlesOpen(false)} />}
  </Page>
}
