import { useState } from 'react'
import { Button, Card, Col, Input, Row, Statistic, Table, Tag, type TableColumnsType } from 'antd'
import { Plus, Search } from 'lucide-react'
import { Page } from '../../shared/components/Page'
import { QueryError } from '../../shared/components/QueryError'
import { useColumnSort } from '../../shared/components/sortableColumn'
import { Money } from '../../shared/components/Money'
import { currency } from '../../shared/utils/format'
import { tablePagination, tableScrollHeight } from '../../shared/utils/table'
import { CreateOrderModal } from '../orders/components/CreateOrderModal'
import { CustomerDrawer } from './components/CustomerDrawer'
import { CustomerFormModal } from './components/CustomerFormModal'
import type { Customer } from './types'
import { useCustomers } from './useCustomers'
import { matchesSearch } from '../../shared/utils/search'

export function CustomersPage() {
  const customersQuery = useCustomers()
  const [query, setQuery] = useState('')
  const [profileId, setProfileId] = useState<string | null>(null)
  // undefined: đóng; null: thêm mới; Customer: sửa.
  const [editing, setEditing] = useState<Customer | null | undefined>(undefined)
  const [orderFor, setOrderFor] = useState<Customer | null>(null)

  const customers = customersQuery.data ?? []
  const visible = customers.filter((customer) => matchesSearch(query, `${customer.id} ${customer.name} ${customer.phone} ${customer.area}`, customer.phone))
  const totalBottles = customers.reduce((sum, customer) => sum + customer.bottlesHeld, 0)
  const totalDeposit = customers.reduce((sum, customer) => sum + customer.depositHeld, 0)
  const totalDebt = customers.reduce((sum, customer) => sum + customer.debt, 0)

  const sort = useColumnSort<Customer>({ key: 'orders', order: 'descend' })
  const columns: TableColumnsType<Customer> = [
    {
      ...sort.column('Khách hàng', 'name', 'text'),
      dataIndex: 'name',
      width: 260,
      onHeaderCell: () => ({ style: { paddingInlineStart: 20 } }),
      onCell: () => ({ style: { paddingInlineStart: 20 } }),
      sorter: (a, b) => a.name.localeCompare(b.name, 'vi'),
      render: (_, customer) => (
        <div className="af-cell-stack">
          <button type="button" className="af-link-button af-cell-truncate" title={`Xem hồ sơ ${customer.name}`} onClick={() => setProfileId(customer.id)}>
            {customer.name}
          </button>
          <small>
            <a href={`tel:${customer.phone.replace(/\s/g, '')}`}>{customer.phone}</a>
          </small>
        </div>
      ),
    },
    { title: 'Khu vực', dataIndex: 'area', ellipsis: true },
    { ...sort.column('Số đơn', 'orders', 'number'), dataIndex: 'orders', align: 'right', width: 100, sorter: (a, b) => a.orders - b.orders },
    {
      ...sort.column('Còn phải thu', 'debt', 'number'),
      dataIndex: 'debt',
      align: 'right',
      width: 140,
      sorter: (a, b) => a.debt - b.debt,
      render: (debt: number) => (debt > 0 ? <Money value={debt} tone="due" /> : <span className="af-text-muted">—</span>),
    },
    {
      ...sort.column('Vỏ đang giữ', 'bottlesHeld', 'number'),
      dataIndex: 'bottlesHeld',
      width: 130,
      sorter: (a, b) => a.bottlesHeld - b.bottlesHeld,
      render: (count: number) => (count > 0 ? <Tag color="orange">{count} vỏ</Tag> : <Tag>Không</Tag>),
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 160,
      render: (_, customer) => (
        <span className="af-row-actions">
          <Button size="small" onClick={() => setProfileId(customer.id)}>
            Hồ sơ
          </Button>
          <Button size="small" onClick={() => setOrderFor(customer)}>
            Tạo đơn
          </Button>
        </span>
      ),
    },
  ]

  return (
    <Page
      title="Khách hàng"
      description="Hồ sơ liên hệ, lịch sử mua, công nợ và sổ vỏ bình của từng khách."
      actions={
        <Button type="primary" icon={<Plus size={16} />} onClick={() => setEditing(null)}>
          Thêm khách hàng
        </Button>
      }
    >
      {customersQuery.isError ? (
        <Card>
          <QueryError error={customersQuery.error} onRetry={customersQuery.refetch} />
        </Card>
      ) : (
        <>
          <Row gutter={[12, 12]} className="af-stat-row">
            <Col xs={12} lg={6}>
              <Card loading={customersQuery.isPending}>
                <Statistic title="Khách hàng" value={customers.length} />
              </Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card loading={customersQuery.isPending}>
                <Statistic className={totalDebt > 0 ? 'af-stat-due' : 'af-stat-paid'} title="Còn phải thu" value={totalDebt} formatter={(value) => currency(Number(value))} />
              </Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card loading={customersQuery.isPending}>
                <Statistic title="Vỏ khách đang giữ" value={totalBottles} suffix="vỏ" />
              </Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card loading={customersQuery.isPending}>
                <Statistic className="af-stat-deposit" title="Tiền cọc đang giữ" value={totalDeposit} formatter={(value) => currency(Number(value))} />
              </Card>
            </Col>
          </Row>
          <Card className="af-card" styles={{ body: { padding: 0 } }}>
            <div className="af-toolbar">
              <span className="af-toolbar-title">Danh sách khách hàng</span>
              <Input
                allowClear
                prefix={<Search size={16} className="af-input-icon" />}
                placeholder="Tìm mã, tên, số điện thoại, khu vực..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="af-search"
              />
            </div>
            <Table<Customer>
              key={query}
              className="af-data-table"
              size="middle"
              rowKey="id"
              columns={columns}
              dataSource={visible}
              loading={customersQuery.isPending}
              pagination={tablePagination}
              locale={{ emptyText: query.trim() ? 'Không tìm thấy khách hàng phù hợp.' : 'Chưa có khách hàng nào.' }}
              scroll={{ x: 920, y: tableScrollHeight }}
            />
          </Card>
        </>
      )}
      {profileId && (
        <CustomerDrawer
          key={profileId}
          customerId={profileId}
          onClose={() => setProfileId(null)}
          onEdit={(customer) => setEditing(customer)}
          onCreateOrder={(customer) => setOrderFor(customer)}
        />
      )}
      <CustomerFormModal
        open={editing !== undefined}
        customer={editing ?? undefined}
        onClose={() => setEditing(undefined)}
        onSaved={(customer) => editing === null && setProfileId(customer.id)}
      />
      <CreateOrderModal
        open={orderFor !== null}
        defaultCustomer={orderFor?.name}
        defaultPhone={orderFor?.phone}
        defaultAddress={orderFor?.addresses[0]}
        onClose={() => setOrderFor(null)}
      />
    </Page>
  )
}
