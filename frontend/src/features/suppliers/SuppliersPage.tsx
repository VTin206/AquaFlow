import { useState } from 'react'
import { Button, Card, Empty, Input, Table, type TableColumnsType } from 'antd'
import { Plus, Search } from 'lucide-react'
import { Page } from '../../shared/components/Page'
import { QueryError } from '../../shared/components/QueryError'
import { CountLabel } from '../../shared/components/CountLabel'
import { useColumnSort } from '../../shared/components/sortableColumn'
import { tablePagination, tableScrollHeight } from '../../shared/utils/table'
import { SupplierFormModal } from './components/SupplierFormModal'
import { useSuppliers } from './useSuppliers'
import type { Supplier } from './types'
import { matchesSearch } from '../../shared/utils/search'

type SortColumn = ReturnType<typeof useColumnSort<Supplier>>['column']

const supplierColumns = (sortColumn: SortColumn): TableColumnsType<Supplier> => [
  {
    ...sortColumn('Nhà cung cấp', 'name', 'text'), dataIndex: 'name', width: 260,
    sorter: (a, b) => a.name.localeCompare(b.name, 'vi'),
    render: (_, supplier) => <div className="af-cell-stack"><span className="af-cell-truncate" title={supplier.name}>{supplier.name}</span><small>{supplier.id}</small></div>,
  },
  {
    title: 'Liên hệ', dataIndex: 'phone', width: 200,
    render: (_, supplier) => <div className="af-cell-stack"><span className="af-cell-truncate" title={supplier.contactName}>{supplier.contactName || 'Chưa có người liên hệ'}</span><small><a href={`tel:${supplier.phone}`}>{supplier.phone}</a></small></div>,
  },
  { title: 'Email', dataIndex: 'email', width: 230, ellipsis: true, render: (email?: string) => email ? <a href={`mailto:${email}`}>{email}</a> : '—' },
  { title: 'Địa chỉ', dataIndex: 'address', width: 300, ellipsis: true },
]

export function SuppliersPage() {
  const suppliersQuery = useSuppliers()
  const sort = useColumnSort<Supplier>()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [adding, setAdding] = useState(false)
  const keyword = query.trim()
  const suppliers = suppliersQuery.data ?? []
  const visible = suppliers.filter((supplier) => matchesSearch(query, [supplier.id, supplier.name, supplier.contactName, supplier.phone, supplier.email, supplier.address].join(' '), supplier.phone))

  return (
    <Page title="Nhà cung cấp" description="Quản lý thông tin và đầu mối liên hệ của các đơn vị cung cấp hàng."
      actions={<Button type="primary" icon={<Plus size={16} />} onClick={() => setAdding(true)}>Thêm nhà cung cấp</Button>}
    >
      <Card className="af-card" styles={{ body: { padding: 0 } }}>
        {suppliersQuery.isError ? <QueryError error={suppliersQuery.error} onRetry={suppliersQuery.refetch} /> : (
          <>
            <div className="af-toolbar">
              <span className="af-toolbar-title"><CountLabel label="Danh sách nhà cung cấp" count={suppliers.length} /></span>
              <Input allowClear className="af-search" prefix={<Search size={16} className="af-input-icon" />} aria-label="Tìm nhà cung cấp" placeholder="Tìm tên, mã, số điện thoại..." value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} />
            </div>
            <Table<Supplier>
              className="af-data-table" size="middle" rowKey="id" columns={supplierColumns(sort.column)} dataSource={visible} loading={suppliersQuery.isPending}
              pagination={{ ...tablePagination, current: page, pageSize, onChange: (nextPage, nextSize) => { setPage(nextSize === pageSize ? nextPage : 1); setPageSize(nextSize) } }}
              scroll={{ x: 990, y: tableScrollHeight }}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={keyword ? 'Không tìm thấy nhà cung cấp phù hợp.' : 'Chưa có nhà cung cấp nào.'}>{keyword ? <Button onClick={() => { setQuery(''); setPage(1) }}>Xóa tìm kiếm</Button> : <Button type="primary" onClick={() => setAdding(true)}>Thêm nhà cung cấp</Button>}</Empty> }}
            />
          </>
        )}
      </Card>
      {adding && <SupplierFormModal onClose={() => setAdding(false)} onCreated={() => { setAdding(false); setQuery(''); setPage(1) }} />}
    </Page>
  )
}
