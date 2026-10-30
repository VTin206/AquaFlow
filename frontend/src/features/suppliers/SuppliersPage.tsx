import { useState } from 'react'
import { App, Button, Card, Dropdown, Empty, Input, Segmented, Space, Table, Tag, Tooltip, type TableColumnsType } from 'antd'
import { Ellipsis, Pencil, Plus, Search } from 'lucide-react'
import { Page } from '../../shared/components/Page'
import { QueryError } from '../../shared/components/QueryError'
import { CountLabel } from '../../shared/components/CountLabel'
import { useColumnSort } from '../../shared/components/sortableColumn'
import { useFeature } from '../../shared/features'
import { Unsupported } from '../../shared/components/Unsupported'
import { tablePagination, tableScrollHeight } from '../../shared/utils/table'
import { SupplierFormModal } from './components/SupplierFormModal'
import type { SupplierStatus } from './supplierService'
import { useCanManageSuppliers, useDeactivateSupplier, useSuppliers } from './useSuppliers'
import type { Supplier } from './types'
import { matchesSearch } from '../../shared/utils/search'

const statusOptions: { value: SupplierStatus; label: string }[] = [
  { value: 'active', label: 'Đang hợp tác' },
  { value: 'inactive', label: 'Ngừng hợp tác' },
  { value: 'all', label: 'Tất cả' },
]

export function SuppliersPage() {
  const { message, modal } = App.useApp()
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

  // Ngừng hợp tác ít khi dùng nên nằm trong menu ⋯; hộp xác nhận nói rõ hậu quả thay vì tô đỏ.
  const confirmStop = (supplier: Supplier) => modal.confirm({
    title: 'Ngừng hợp tác?',
    content: <div className="af-confirm-body"><p><strong>{supplier.name}</strong> sẽ không chọn được khi tạo phiếu nhập mới.</p><p>Phiếu nhập cũ vẫn giữ nguyên.</p></div>,
    centered: true,
    okText: 'Ngừng hợp tác',
    cancelText: 'Không',
    onOk: () => deactivate.mutateAsync(supplier.id).then(() => { message.success(`Đã ngừng hợp tác với ${supplier.name}.`) }, (error: Error) => { message.error(error.message) }),
  })

  const columns: TableColumnsType<Supplier> = [
    {
      ...sort.column('Nhà cung cấp', 'name', 'text'), dataIndex: 'name', width: 260,
      sorter: (a, b) => a.name.localeCompare(b.name, 'vi'),
      render: (_, supplier) => (
        <div className="af-cell-stack">
          <span className="af-name-with-tag"><span className="af-cell-truncate" title={supplier.name}>{supplier.name}</span>{!supplier.active && <Tag className="af-inactive-tag">Ngừng hợp tác</Tag>}</span>
          <small>{supplier.code}</small>
        </div>
      ),
    },
    {
      title: 'Liên hệ', dataIndex: 'phone', width: 200,
      render: (_, supplier) => (
        <div className="af-cell-stack">
          {showContact ? <span className="af-cell-truncate" title={supplier.contactName}>{supplier.contactName || 'Chưa có người liên hệ'}</span> : <Unsupported label="Người liên hệ: chưa hỗ trợ" />}
          <small>{supplier.phone ? <a href={`tel:${supplier.phone}`}>{supplier.phone}</a> : '—'}</small>
        </div>
      ),
    },
    { title: 'Email', dataIndex: 'email', width: 230, ellipsis: true, render: (email?: string) => (!showEmail ? <Unsupported /> : email ? <a href={`mailto:${email}`}>{email}</a> : '—') },
    { title: 'Địa chỉ', dataIndex: 'address', width: 300, ellipsis: true, render: (address?: string) => address || '—' },
    ...(canManage ? [
      {
        title: 'Thao tác', key: 'actions', width: 100, fixed: 'right' as const,
        render: (_: unknown, supplier: Supplier) => (
          <Space size={4}>
            <Tooltip title="Sửa"><Button size="small" icon={<Pencil size={15} />} aria-label={`Sửa ${supplier.name}`} onClick={() => setEditing(supplier)} /></Tooltip>
            {supplier.active && (
              <Dropdown trigger={['click']} menu={{ items: [{ key: 'stop', label: 'Ngừng hợp tác', disabled: deactivate.isPending, onClick: () => confirmStop(supplier) }] }}>
                <Button size="small" type="text" icon={<Ellipsis size={16} />} aria-label={`Thao tác khác với ${supplier.name}`} />
              </Dropdown>
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
              className="af-data-table af-table-flush" size="middle" rowKey="id" columns={columns} dataSource={visible} loading={suppliersQuery.isPending}
              pagination={{ ...tablePagination, current: page, pageSize, onChange: (nextPage, nextSize) => { setPage(nextSize === pageSize ? nextPage : 1); setPageSize(nextSize) } }}
              rowClassName={(supplier) => (supplier.active ? '' : 'af-row-inactive')}
              scroll={{ x: 890, y: tableScrollHeight }}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={keyword ? 'Không tìm thấy nhà cung cấp phù hợp.' : effectiveStatus === 'inactive' ? 'Không có nhà cung cấp đã ngừng hợp tác.' : 'Chưa có nhà cung cấp nào.'}>{keyword ? <Button onClick={() => { setQuery(''); setPage(1) }}>Xóa tìm kiếm</Button> : canManage && effectiveStatus !== 'inactive' && <Button type="primary" onClick={() => setEditing(null)}>Thêm nhà cung cấp</Button>}</Empty> }}
            />
          </>
        )}
      </Card>
      {editing !== undefined && <SupplierFormModal key={editing?.id ?? 'new'} supplier={editing ?? undefined} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); if (!editing) { setQuery(''); setPage(1) } }} />}
    </Page>
  )
}
