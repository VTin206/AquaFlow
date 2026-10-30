import { useState } from 'react'
import { App, Button, Card, Col, Dropdown, Grid, Input, Row, Segmented, Statistic, Table, Tag, Tooltip, type TableColumnsType } from 'antd'
import { Ellipsis, Eye, Plus, Search } from 'lucide-react'
import { Page } from '../../shared/components/Page'
import { QueryError } from '../../shared/components/QueryError'
import { useColumnSort } from '../../shared/components/sortableColumn'
import { Money } from '../../shared/components/Money'
import { currency } from '../../shared/utils/format'
import { tablePagination, tableScrollHeight } from '../../shared/utils/table'
import { useFeature, useIsDemo } from '../../shared/features'
import { Unsupported } from '../../shared/components/Unsupported'
import { LiveOrderDraftModal } from '../live/LiveOrderDraftModal'
import { CreateOrderModal } from '../orders/components/CreateOrderModal'
import { CustomerDrawer } from './components/CustomerDrawer'
import { CustomerFormModal } from './components/CustomerFormModal'
import { CustomerCards } from './components/CustomerCards'
import { customerCode, type Customer } from './types'
import { useActivateCustomer, useArchivedCustomers, useCustomers } from './useCustomers'
import { matchesSearch } from '../../shared/utils/search'

export function CustomersPage() {
  const screens = Grid.useBreakpoint()
  const demo = useIsDemo()
  const showArea = useFeature('customerProfileExtras')
  const showDebt = useFeature('customerDebt')
  const showBottles = useFeature('bottleLedger')
  const customersQuery = useCustomers()
  const { message } = App.useApp()
  const canReactivate = useFeature('reactivate')
  // Khách đã lưu trữ chỉ xem được khi BE có API (bản dùng thử thì luôn có).
  const [view, setView] = useState<'active' | 'archived'>('active')
  const archivedQuery = useArchivedCustomers(canReactivate && view === 'archived')
  const activate = useActivateCustomer()
  const [query, setQuery] = useState('')
  const [profileId, setProfileId] = useState<string | null>(null)
  // undefined: đóng; null: thêm mới; Customer: sửa.
  const [editing, setEditing] = useState<Customer | null | undefined>(undefined)
  const [orderFor, setOrderFor] = useState<Customer | null>(null)

  const customers = customersQuery.data ?? []
  const visible = customers.filter((customer) => matchesSearch(query, `${customerCode(customer)} ${customer.name} ${customer.phone} ${customer.area}`, customer.phone))
  const totalBottles = customers.reduce((sum, customer) => sum + customer.bottlesHeld, 0)
  const totalDeposit = customers.reduce((sum, customer) => sum + customer.depositHeld, 0)
  const totalDebt = customers.reduce((sum, customer) => sum + customer.debt, 0)

  const archived = (archivedQuery.data ?? []).filter((customer) => matchesSearch(query, `${customerCode(customer)} ${customer.name} ${customer.phone} ${customer.area}`, customer.phone))
  const restore = (customer: Customer) =>
    activate.mutateAsync(customer.id).then(() => { message.success(`Đã khôi phục hồ sơ ${customer.name}.`) }, (error: Error) => { message.error(error.message) })
  const archivedColumns: TableColumnsType<Customer> = [
    {
      title: 'Khách hàng', dataIndex: 'name', width: 260,
      render: (_, customer) => (
        <div className="af-cell-stack">
          <span className="af-name-with-tag"><span className="af-cell-truncate">{customer.name}</span><Tag className="af-inactive-tag">Đã lưu trữ</Tag></span>
          <small>{customerCode(customer)}</small>
        </div>
      ),
    },
    { title: 'Số điện thoại', dataIndex: 'phone', width: 160, render: (phone: string) => phone || '—' },
    { title: 'Khu vực', dataIndex: 'area', width: 160, render: (area: string) => area || '—' },
    {
      title: 'Thao tác', key: 'action', width: 90,
      render: (_, customer) => (
        <Dropdown trigger={['click']} menu={{ items: [{ key: 'restore', label: 'Khôi phục hồ sơ', disabled: activate.isPending, onClick: () => void restore(customer) }] }}>
          <Button size="small" type="text" icon={<Ellipsis size={16} />} aria-label={`Thao tác khác với ${customer.name}`} />
        </Dropdown>
      ),
    },
  ]

  const sort = useColumnSort<Customer>({ key: 'orders', order: 'descend' })
  const unsupported = (title: string) => <Statistic title={title} valueRender={() => <Unsupported />} />
  const stats = [
    { key: 'count', node: <Statistic title="Khách hàng" value={customers.length} /> },
    { key: 'debt', node: showDebt ? <Statistic className={totalDebt > 0 ? 'af-stat-due' : 'af-stat-paid'} title="Còn phải thu" value={totalDebt} formatter={(value) => currency(Number(value))} /> : unsupported('Còn phải thu') },
    { key: 'bottles', node: showBottles ? <Statistic title="Vỏ khách đang giữ" value={totalBottles} suffix="vỏ" /> : unsupported('Vỏ khách đang giữ') },
    { key: 'deposit', node: showBottles ? <Statistic className="af-stat-deposit" title="Tiền cọc đang giữ" value={totalDeposit} formatter={(value) => currency(Number(value))} /> : unsupported('Tiền cọc đang giữ') },
  ]

  const columns: TableColumnsType<Customer> = [
    {
      ...sort.column('Khách hàng', 'name', 'text'),
      dataIndex: 'name',
      width: 260,
      sorter: (a, b) => a.name.localeCompare(b.name, 'vi'),
      render: (_, customer) => (
        <div className="af-cell-stack">
          <button type="button" className="af-link-button af-cell-truncate" title={`Xem hồ sơ ${customer.name}`} onClick={() => setProfileId(customer.id)}>
            {customer.name}
          </button>
          <small>
            {customer.phone ? <a href={`tel:${customer.phone.replace(/\s/g, '')}`}>{customer.phone}</a> : 'Chưa có số điện thoại'}
          </small>
        </div>
      ),
    },
    { title: 'Khu vực', dataIndex: 'area', ellipsis: true, render: (area: string) => (showArea ? area : <Unsupported />) },
    { ...sort.column('Số đơn', 'orders', 'number'), dataIndex: 'orders', align: 'right', width: 100, sorter: (a, b) => a.orders - b.orders },
    showDebt ? {
      ...sort.column('Còn phải thu', 'debt', 'number'),
      dataIndex: 'debt',
      align: 'right',
      width: 140,
      sorter: (a, b) => a.debt - b.debt,
      render: (debt: number) => (debt > 0 ? <Money value={debt} tone="due" /> : <span className="af-text-muted">—</span>),
    } : { title: 'Còn phải thu', key: 'debt', align: 'right', width: 140, render: () => <Unsupported /> },
    showBottles ? {
      ...sort.column('Vỏ đang giữ', 'bottlesHeld', 'number'),
      dataIndex: 'bottlesHeld',
      width: 130,
      sorter: (a, b) => a.bottlesHeld - b.bottlesHeld,
      render: (count: number) => (count > 0 ? <Tag color="orange">{count} vỏ</Tag> : <Tag>Không</Tag>),
    } : { title: 'Vỏ đang giữ', key: 'bottlesHeld', width: 130, render: () => <Unsupported /> },
    {
      title: 'Thao tác',
      key: 'action',
      width: 130,
      render: (_, customer) => (
        <span className="af-row-actions">
          <Tooltip title="Xem hồ sơ">
            <Button size="small" icon={<Eye size={15} />} aria-label={`Xem hồ sơ ${customer.name}`} onClick={() => setProfileId(customer.id)} />
          </Tooltip>
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
            {stats.map((stat) => (
              <Col key={stat.key} xs={24} sm={12} lg={6}>
                <Card loading={customersQuery.isPending}>{stat.node}</Card>
              </Col>
            ))}
          </Row>
          <Card className="af-card" styles={{ body: { padding: 0 } }}>
            <div className="af-toolbar">
              <Segmented<'active' | 'archived'>
                value={view}
                onChange={setView}
                options={[
                  { value: 'active', label: 'Đang hoạt động' },
                  { value: 'archived', label: canReactivate ? 'Đã lưu trữ' : <Tooltip title="Backend chưa hỗ trợ xem khách đã lưu trữ">Đã lưu trữ</Tooltip>, disabled: !canReactivate },
                ]}
              />
              <Input
                allowClear
                prefix={<Search size={16} className="af-input-icon" />}
                placeholder="Tìm mã, tên, số điện thoại, khu vực..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="af-search"
              />
            </div>
            {view === 'archived' ? (
              archivedQuery.isError ? <QueryError error={archivedQuery.error} onRetry={archivedQuery.refetch} /> : (
                <Table<Customer>
                  className="af-data-table af-table-flush"
                  size="middle"
                  rowKey="id"
                  rowClassName="af-row-inactive"
                  columns={archivedColumns}
                  dataSource={archived}
                  loading={archivedQuery.isPending}
                  pagination={tablePagination}
                  locale={{ emptyText: query.trim() ? 'Không tìm thấy khách hàng phù hợp.' : 'Không có hồ sơ nào đã lưu trữ.' }}
                  scroll={{ x: 670 }}
                />
              )
            ) : screens.md === false ? (
              <CustomerCards
                key={query}
                customers={visible}
                loading={customersQuery.isPending}
                emptyText={query.trim() ? 'Không tìm thấy khách hàng phù hợp.' : 'Chưa có khách hàng nào.'}
                onProfile={setProfileId}
                onCreateOrder={setOrderFor}
              />
            ) : <Table<Customer>
              key={query}
              className="af-data-table af-table-flush"
              size="middle"
              rowKey="id"
              columns={columns}
              dataSource={visible}
              loading={customersQuery.isPending}
              pagination={tablePagination}
              locale={{ emptyText: query.trim() ? 'Không tìm thấy khách hàng phù hợp.' : 'Chưa có khách hàng nào.' }}
              scroll={{ x: 920, y: tableScrollHeight }}
            />}
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
      {!demo && orderFor && (
        <LiveOrderDraftModal
          defaultCustomer={{ id: Number(orderFor.id), name: orderFor.name, phone: orderFor.phone || undefined }}
          onClose={() => setOrderFor(null)}
          onCreated={() => setOrderFor(null)}
        />
      )}
      <CreateOrderModal
        open={demo && orderFor !== null}
        defaultCustomer={orderFor?.name}
        defaultPhone={orderFor?.phone}
        defaultAddress={orderFor?.addresses[0]}
        onClose={() => setOrderFor(null)}
      />
    </Page>
  )
}
