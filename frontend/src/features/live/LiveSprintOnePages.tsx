import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag } from 'antd'
import { api } from '../../shared/api/client'
import { Page } from '../../shared/components/Page'
import { QueryError } from '../../shared/components/QueryError'
import { useStaff } from '../auth/useStaff'
import { LiveCustomerAddresses } from './LiveCustomerAddresses'
import { LiveBottleTypes } from './LiveBottleTypes'
import { bottleTypeApi } from './bottleTypeApi'
import { invalidateLiveData } from './invalidateLiveData'
import { matchesSearch } from '../../shared/utils/search'

type ProductDto = {
  id: number; sku: string; name: string; brand: string | null; unit: string
  unitsPerCase: number | null; bottleTypeId: number | null; salePrice: number; active: boolean
}
type ProductDraft = Omit<ProductDto, 'id' | 'active'>
type SupplierDto = { id: number; name: string; phone: string | null; address: string | null; active: boolean }
type SupplierDraft = Pick<SupplierDto, 'name' | 'phone' | 'address'>
type CustomerDto = { id: number; fullName: string; phone: string | null; createdAt: string }
type CustomerDraft = Pick<CustomerDto, 'fullName' | 'phone'>
type CatalogFilter = 'active' | 'inactive' | 'all'
const filterOptions = [{ value: 'active', label: 'Đang hoạt động' }, { value: 'inactive', label: 'Đã ngừng dùng' }, { value: 'all', label: 'Tất cả' }]
const activeQuery = (filter: CatalogFilter) => filter === 'all' ? '' : `?active=${filter === 'active'}`

const phone = (value: string | null | undefined) => value?.replace(/[\s().-]/g, '') || null

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

export function LiveSuppliersPage() {
  const { message } = App.useApp()
  const admin = useStaff()?.role === 'ADMIN'
  const queryClient = useQueryClient()
  const [form] = Form.useForm<SupplierDraft>()
  const [editing, setEditing] = useState<SupplierDto | null | undefined>()
  const [filter, setFilter] = useState<CatalogFilter>('active')
  const [search, setSearch] = useState('')
  const effectiveFilter = admin ? filter : 'active'
  const suppliers = useQuery({ queryKey: ['live', 'suppliers', effectiveFilter], queryFn: () => api.get<SupplierDto[]>(`/suppliers${activeQuery(effectiveFilter)}`) })
  const save = useMutation({
    mutationFn: (draft: SupplierDraft) => {
      const input = { name: draft.name.trim(), phone: phone(draft.phone), address: draft.address?.trim() || null }
      return editing ? api.put<SupplierDto>(`/suppliers/${editing.id}`, input) : api.post<SupplierDto>('/suppliers', input)
    },
    onSuccess: () => { void invalidateLiveData(queryClient); setEditing(undefined); message.success('Đã lưu nhà cung cấp.') },
    onError: (error: Error) => message.error(error.message),
  })
  const deactivate = useMutation({
    mutationFn: (id: number) => api.delete<void>(`/suppliers/${id}`),
    onSuccess: () => { void invalidateLiveData(queryClient); message.success('Đã ngừng sử dụng nhà cung cấp.') },
    onError: (error: Error) => message.error(error.message),
  })
  const open = (supplier: SupplierDto | null) => { setEditing(supplier); form.setFieldsValue(supplier ?? { name: '', phone: null, address: null }) }

  return <Page title="Nhà cung cấp" description="Danh sách nhà cung cấp từ backend." actions={admin ? <Button type="primary" onClick={() => open(null)}>Thêm nhà cung cấp</Button> : undefined}>
    <Space wrap style={{ marginBottom: 16 }}>
      <Input aria-label="Tìm nhà cung cấp" placeholder="Tìm tên, điện thoại, địa chỉ" allowClear value={search} onChange={(event) => setSearch(event.target.value)} />
      {admin && <Select aria-label="Trạng thái nhà cung cấp" value={filter} onChange={setFilter} options={filterOptions} />}
      <Button loading={suppliers.isFetching} onClick={() => void suppliers.refetch()}>Làm mới</Button>
    </Space>
    {suppliers.isError ? <QueryError error={suppliers.error} onRetry={suppliers.refetch} /> : <Table<SupplierDto> key={`${effectiveFilter}:${search}`} rowKey="id" loading={suppliers.isPending} dataSource={(suppliers.data ?? []).filter((item) => matchesSearch(search, `${item.name} ${item.phone ?? ''} ${item.address ?? ''}`))} pagination={{ pageSize: 10 }} scroll={{ x: 680 }} columns={[
      { title: 'Tên', dataIndex: 'name' }, { title: 'Số điện thoại', dataIndex: 'phone', render: (v: string | null) => v || '—' }, { title: 'Địa chỉ', dataIndex: 'address', render: (v: string | null) => v || '—' },
      { title: 'Trạng thái', dataIndex: 'active', render: (value: boolean) => <Tag color={value ? 'green' : 'default'}>{value ? 'Đang dùng' : 'Đã ngừng dùng'}</Tag> },
      ...(admin ? [{ title: 'Thao tác', key: 'actions', render: (_: unknown, item: SupplierDto) => <><Button type="link" onClick={() => open(item)}>Sửa</Button>{item.active && <Popconfirm title="Ngừng sử dụng nhà cung cấp?" onConfirm={() => deactivate.mutateAsync(item.id).catch(() => undefined)}><Button type="link" danger disabled={deactivate.isPending}>Ngừng dùng</Button></Popconfirm>}</> }] : []),
    ]} />}
    <Modal title={editing ? 'Sửa nhà cung cấp' : 'Thêm nhà cung cấp'} open={editing !== undefined} onCancel={() => setEditing(undefined)} onOk={() => form.submit()} confirmLoading={save.isPending} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={(draft) => save.mutate(draft)}>
        <Form.Item label="Tên" name="name" rules={[{ required: true, max: 200 }]}><Input /></Form.Item>
        <Form.Item label="Số điện thoại" name="phone" rules={[{ pattern: /^(0|\+84)[0-9]{9,10}$/, message: 'Số điện thoại không hợp lệ.' }]}><Input /></Form.Item>
        <Form.Item label="Địa chỉ" name="address" rules={[{ max: 500 }]}><Input.TextArea /></Form.Item>
      </Form>
    </Modal>
  </Page>
}

export function LiveCustomersPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [form] = Form.useForm<CustomerDraft>()
  const [editing, setEditing] = useState<CustomerDto | null | undefined>()
  const [addressCustomer, setAddressCustomer] = useState<CustomerDto | null>(null)
  const customers = useQuery({ queryKey: ['live', 'customers'], queryFn: () => api.get<CustomerDto[]>('/sales/customers') })
  const save = useMutation({
    mutationFn: (draft: CustomerDraft) => {
      const input = { fullName: draft.fullName.trim(), phone: phone(draft.phone) }
      return editing ? api.put<CustomerDto>(`/sales/customers/${editing.id}`, input) : api.post<CustomerDto>('/sales/customers', input)
    },
    onSuccess: () => { void invalidateLiveData(queryClient); setEditing(undefined); message.success('Đã lưu khách hàng.') },
    onError: (error: Error) => message.error(error.message),
  })
  const deactivate = useMutation({
    mutationFn: (id: number) => api.delete<void>(`/sales/customers/${id}`),
    onSuccess: () => { void invalidateLiveData(queryClient); message.success('Đã ngừng sử dụng hồ sơ khách hàng.') },
    onError: (error: Error) => message.error(error.message),
  })
  const open = (customer: CustomerDto | null) => { setEditing(customer); form.setFieldsValue(customer ?? { fullName: '', phone: null }) }

  return <Page title="Khách hàng" description="Hồ sơ khách hàng từ backend."><Button type="primary" onClick={() => open(null)} style={{ marginBottom: 16 }}>Thêm khách hàng</Button>
    <Alert type="info" showIcon title="Công nợ, sổ vỏ và số đơn chưa được backend đồng bộ trong Sprint 1." style={{ marginBottom: 16 }} />
    {customers.isError ? <QueryError error={customers.error} onRetry={customers.refetch} /> : <Table<CustomerDto> rowKey="id" loading={customers.isPending} dataSource={customers.data ?? []} pagination={{ pageSize: 10 }} scroll={{ x: 600 }} columns={[
      { title: 'Mã', dataIndex: 'id' }, { title: 'Họ tên', dataIndex: 'fullName' }, { title: 'Số điện thoại', dataIndex: 'phone', render: (v: string | null) => v || '—' },
      { title: 'Trạng thái', render: () => <Tag color="green">Đang hoạt động</Tag> },
      { title: 'Thao tác', key: 'actions', render: (_: unknown, item: CustomerDto) => <><Button type="link" onClick={() => setAddressCustomer(item)}>Địa chỉ</Button><Button type="link" onClick={() => open(item)}>Sửa</Button><Popconfirm title="Ngừng sử dụng hồ sơ khách hàng?" onConfirm={() => deactivate.mutate(item.id)}><Button type="link" danger>Ngừng dùng</Button></Popconfirm></> },
    ]} />}
    <Modal title={editing ? 'Sửa khách hàng' : 'Thêm khách hàng'} open={editing !== undefined} onCancel={() => setEditing(undefined)} onOk={() => form.submit()} confirmLoading={save.isPending} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={(draft) => save.mutate(draft)}>
        <Form.Item label="Họ tên" name="fullName" rules={[{ required: true, max: 150 }]}><Input /></Form.Item>
        <Form.Item label="Số điện thoại" name="phone" rules={[{ pattern: /^(0|\+84)[0-9]{9,10}$/, message: 'Số điện thoại không hợp lệ.' }]}><Input /></Form.Item>
      </Form>
    </Modal>
    {addressCustomer && <LiveCustomerAddresses customerId={addressCustomer.id} customerName={addressCustomer.fullName} onClose={() => setAddressCustomer(null)} />}
  </Page>
}
