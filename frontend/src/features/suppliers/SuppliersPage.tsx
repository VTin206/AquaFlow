import { useState } from 'react'
import { App, Button, Card, Empty, Input, Popconfirm, Segmented, Space, Table, Tag, type TableColumnsType } from 'antd'
import { Plus, Search } from 'lucide-react'
import { Page } from '../../shared/components/Page'
import { QueryError } from '../../shared/components/QueryError'
import { CountLabel } from '../../shared/components/CountLabel'
import { useColumnSort } from '../../shared/components/sortableColumn'
import { useFeature } from '../../shared/features'
import { tablePagination, tableScrollHeight } from '../../shared/utils/table'
import { SupplierFormModal } from './components/SupplierFormModal'
import type { SupplierStatus } from './supplierService'
import { useCanManageSuppliers, useDeactivateSupplier, useSuppliers } from './useSuppliers'
import type { Supplier } from './types'
import { matchesSearch } from '../../shared/utils/search'

const statusOptions: { value: SupplierStatus; label: string }[] = [
  { value: 'active', label: 'Đang dùng' },
  { value: 'inactive', label: 'Đã ngừng dùng' },
  { value: 'all', label: 'Tất cả' },
]

export function SuppliersPage() {
  const { message } = App.useApp()
  const canManage = useCanManageSuppliers()
  const showContact = useFeature('supplierContactName')
  const showEmail = useFeature('supplierEmail')
  const [status, setStatus] = useState<SupplierStatus>('active')
  // Nhân viên không quản lý chỉ xem nhà cung cấp đang dùng (BE cũng giới hạn như vậy).
  const effectiveStatus = canManage ? status : 'active'
  const suppliersQuery = useSuppliers(effectiveStatus)
  const deactivate = useDeactivateSupplier()
  const sort = useColumnSort<Supplier>()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [editing, setEditing] = useState<Supplier | null>()
  const keyword = query.trim()
  const suppliers = suppliersQuery.data ?? []
  const visible = suppliers.filter((supplier) => matchesSearch(query, [supplier.code, supplier.name, supplier.contactName, supplier.phone, supplier.email, supplier.address].join(' '), supplier.phone ?? ''))

  const columns: TableColumnsType<Supplier> = [
    {
      ...sort.column('Nhà cung cấp', 'name', 'text'), dataIndex: 'name', width: 260,
      sorter: (a, b) => a.name.localeCompare(b.name, 'vi'),
      render: (_, supplier) => <div className="af-cell-stack"><span className="af-cell-truncate" title={supplier.name}>{supplier.name}</span><small>{supplier.code}</small></div>,
    },
    {
      title: 'Liên hệ', dataIndex: 'phone', width: 200,
      render: (_, supplier) => showContact
        ? <div className="af-cell-stack"><span className="af-cell-truncate" title={supplier.contactName}>{supplier.contactName || 'Chưa có người liên hệ'}</span><small>{supplier.phone ? <a href={`tel:${supplier.phone}`}>{supplier.phone}</a> : '—'}</small></div>
        : supplier.phone ? <a href={`tel:${supplier.phone}`}>{supplier.phone}</a> : '—',
    },
    ...(showEmail ? [{ title: 'Email', dataIndex: 'email', width: 230, ellipsis: true, render: (email?: string) => email ? <a href={`mailto:${email}`}>{email}</a> : '—' }] : []),
    { title: 'Địa chỉ', dataIndex: 'address', width: 300, ellipsis: true, render: (address?: string) => address || '—' },
    ...(canManage ? [
      { title: 'Trạng thái', dataIndex: 'active', width: 130, render: (active: boolean) => <Tag color={active ? 'green' : 'default'}>{active ? 'Đang dùng' : 'Đã ngừng dùng'}</Tag> },
      {
        title: 'Thao tác', key: 'actions', width: 170, fixed: 'right' as const,
        render: (_: unknown, supplier: Supplier) => (
          <Space size={4}>
            <Button size="small" onClick={() => setEditing(supplier)}>Sửa</Button>
            {supplier.active && (
              <Popconfirm title={`Ngừng dùng ${supplier.name}?`} description="Nhà cung cấp sẽ không còn trong danh sách chọn khi nhập kho. Phiếu nhập cũ vẫn giữ nguyên." okText="Ngừng dùng" okButtonProps={{ danger: true }} cancelText="Không"
                onConfirm={() => deactivate.mutateAsync(supplier.id).then(() => { message.success(`Đã ngừng dùng ${supplier.name}.`) }, (error: Error) => { message.error(error.message) })}>
                <Button size="small" type="text" danger disabled={deactivate.isPending}>Ngừng dùng</Button>
              </Popconfirm>
            )}
          </Space>
        ),
      },
    ] : []),
  ]

  return (
    <Page title="Nhà cung cấp" description="Quản lý thông tin và đầu mối liên hệ của các đơn vị cung cấp hàng."
      actions={canManage ? <Button type="primary" icon={<Plus size={16} />} onClick={() => setEditing(null)}>Thêm nhà cung cấp</Button> : undefined}
    >
      <Card className="af-card" styles={{ body: { padding: 0 } }}>
        {suppliersQuery.isError ? <QueryError error={suppliersQuery.error} onRetry={suppliersQuery.refetch} /> : (
          <>
            <div className="af-toolbar">
              {canManage
                ? <Segmented<SupplierStatus> value={status} onChange={(next) => { setStatus(next); setPage(1) }} options={statusOptions} />
                : <span className="af-toolbar-title"><CountLabel label="Danh sách nhà cung cấp" count={suppliers.length} /></span>}
              <Input allowClear className="af-search" prefix={<Search size={16} className="af-input-icon" />} aria-label="Tìm nhà cung cấp" placeholder="Tìm tên, mã, số điện thoại..." value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} />
            </div>
            <Table<Supplier>
              className="af-data-table" size="middle" rowKey="id" columns={columns} dataSource={visible} loading={suppliersQuery.isPending}
              pagination={{ ...tablePagination, current: page, pageSize, onChange: (nextPage, nextSize) => { setPage(nextSize === pageSize ? nextPage : 1); setPageSize(nextSize) } }}
              scroll={{ x: 990, y: tableScrollHeight }}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={keyword ? 'Không tìm thấy nhà cung cấp phù hợp.' : effectiveStatus === 'inactive' ? 'Không có nhà cung cấp đã ngừng dùng.' : 'Chưa có nhà cung cấp nào.'}>{keyword ? <Button onClick={() => { setQuery(''); setPage(1) }}>Xóa tìm kiếm</Button> : canManage && effectiveStatus !== 'inactive' && <Button type="primary" onClick={() => setEditing(null)}>Thêm nhà cung cấp</Button>}</Empty> }}
            />
          </>
        )}
      </Card>
      {editing !== undefined && <SupplierFormModal key={editing?.id ?? 'new'} supplier={editing ?? undefined} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); if (!editing) { setQuery(''); setPage(1) } }} />}
    </Page>
  )
}
