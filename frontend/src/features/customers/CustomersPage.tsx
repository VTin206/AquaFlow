import { useMemo, useState } from 'react'
import { filterOn } from '@/shared/utils/filterOn'
import { useSearchParams } from 'react-router'
import {
  App,
  Button,
  Card,
  Col,
  Dropdown,
  Grid,
  Input,
  Row,
  Segmented,
  Select,
  Statistic,
  Table,
  Tag,
  Tooltip,
  type TableColumnsType,
} from 'antd'
import dayjs from 'dayjs'
import { Ellipsis, FileSpreadsheet, Plus, Search } from 'lucide-react'
import { ViewButton } from '@/shared/components/ViewButton'
import { useLinkedQuery } from '@/shared/utils/useLinkedQuery'
import { BulkBar } from '@/shared/components/BulkBar'
import { Page } from '@/shared/components/Page'
import { CountLabel } from '@/shared/components/CountLabel'
import { ToneLabel } from '@/shared/components/ToneLabel'
import { QueryError } from '@/shared/components/QueryError'
import { useColumnSort } from '@/shared/components/sortableColumn'
import { downloadExcel, type ExcelColumn } from '@/shared/utils/excel'
import { currency } from '@/shared/utils/format'
import { serverTablePagination, tablePagination, tableScrollHeight, type ServerPagination } from '@/shared/utils/table'
import { useFeature } from '@/shared/features'
import { LiveReceivables } from './LiveReceivables'
import { LiveBottleOverview } from './LiveBottleOverview'
import { Unsupported } from '@/shared/components/Unsupported'
import { OrderIntakeModal } from '@/features/orders/components/OrderIntakeModal'
import { CustomerDrawer } from './components/CustomerDrawer'
import { CustomerFormModal } from './components/CustomerFormModal'
import { CustomerCards } from './components/CustomerCards'
import { customerCode, type Customer } from './types'
import {
  cardSortOrder,
  useActivateCustomer,
  useArchivedCustomers,
  useCustomerPage,
  type CustomerCardSort,
  type CustomerSort,
} from './useCustomers'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import { matchesSearch } from '@/shared/utils/search'
import { CustomerDebt } from './components/CustomerDebt'
import { idleOptions, lastOrderLabel, type IdleFilter } from './lastOrder'

export function CustomersPage() {
  const screens = Grid.useBreakpoint()
  const showArea = useFeature('customerProfileExtras')
  const showDebt = useFeature('customerDebt')
  const showBottles = useFeature('bottleLedger')
  const { message } = App.useApp()
  const canReactivate = useFeature('reactivate')
  const [exporting, setExporting] = useState(false)
  // Khách đã lưu trữ chỉ xem được khi BE có API (bản dùng thử thì luôn có).
  const [view, setView] = useState<'active' | 'archived'>('active')
  // Tải sẵn để hiện số đếm trên bộ lọc.
  const archivedQuery = useArchivedCustomers(canReactivate)
  const activate = useActivateCustomer()
  const [query, setQuery] = useLinkedQuery()
  const [searchParams, setSearchParams] = useSearchParams()
  const profileId = searchParams.get('customerId')
  const setProfileId = (id: string | null) =>
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        if (id) next.set('customerId', id)
        else next.delete('customerId')
        return next
      },
      { replace: true },
    )
  // undefined: đóng; null: thêm mới; Customer: sửa.
  const [editing, setEditing] = useState<Customer | null | undefined>(undefined)
  const [orderFor, setOrderFor] = useState<Customer | null>(null)
  // Lọc khách lâu chưa mua để gọi mời đặt nước.
  const [idle, setIdle] = useState<IdleFilter>('all')
  // Bảng sắp xếp theo cột (mặc định nhiều đơn trước), thẻ trên điện thoại có ô chọn riêng; BE sắp xếp trên toàn bộ khách.
  const sort = useColumnSort<Customer>({ key: 'orders', order: 'descend' })
  const [cardSort, setCardSort] = useState<CustomerCardSort>('recent')
  const narrow = screens.md === false
  const sortOrder = narrow ? cardSortOrder[cardSort] : (sort.state as CustomerSort)
  // Tìm ở BE: chờ ngừng gõ rồi mới gửi.
  const searched = useDebouncedValue(query)
  const pageFilters = useMemo(() => ({ query: searched, idle, sort: sortOrder }), [searched, idle, sortOrder])
  const filterKey = JSON.stringify(pageFilters)
  // Đổi bộ lọc hoặc cách sắp xếp thì về trang đầu và bỏ các khách đã tích; cỡ trang giữ nguyên.
  const [paging, setPaging] = useState({ filterKey, page: 0, size: tablePagination.defaultPageSize ?? 10 })
  const page = paging.filterKey === filterKey ? paging.page : 0
  const customersQuery = useCustomerPage(pageFilters, page, paging.size)
  const visible = customersQuery.data?.customers ?? []
  const totals = customersQuery.data?.totals
  const server: ServerPagination = {
    page,
    size: paging.size,
    total: customersQuery.data?.total ?? 0,
    onChange: (next, size) => setPaging({ filterKey, page: next, size }),
  }
  const filtered = Boolean(query.trim()) || idle !== 'all'
  // Khách đã tích được giữ khi lật trang (lưu cả hồ sơ để xuất Excel), xóa khi đổi bộ lọc.
  const [checkedState, setCheckedState] = useState<{ filterKey: string; customers: Customer[] }>({ filterKey, customers: [] })
  const checked = checkedState.filterKey === filterKey ? checkedState.customers : []
  const setCheckedIds = (ids: string[]) => {
    const onPage = new Set(visible.map((customer) => customer.id))
    setCheckedState({
      filterKey,
      customers: [...checked.filter((customer) => !onPage.has(customer.id)), ...visible.filter((customer) => ids.includes(customer.id))],
    })
  }
  const exportChecked = async () => {
    setExporting(true)
    const columns: ExcelColumn<Customer>[] = [
      { title: 'Mã khách', width: 12, value: customerCode },
      { title: 'Tên khách', width: 26, value: (customer) => customer.name },
      { title: 'Số điện thoại', width: 15, value: (customer) => customer.phone },
      { title: 'Loại', width: 14, value: (customer) => customer.type },
      ...(showArea ? [{ title: 'Khu vực', width: 20, value: (customer: Customer) => customer.area }] : []),
      { title: 'Địa chỉ giao', width: 40, value: (customer) => customer.addresses.join('; ') },
      { title: 'Số đơn', width: 10, format: 'count', value: (customer) => customer.orders },
      {
        title: 'Lần mua gần nhất',
        width: 18,
        value: (customer) => (customer.lastOrderAt ? dayjs(customer.lastOrderAt).format('DD/MM/YYYY') : ''),
      },
      ...(showBottles
        ? [
            { title: 'Vỏ đang giữ', width: 12, format: 'count', value: (customer: Customer) => customer.bottlesHeld } as const,
            { title: 'Tiền cọc đang giữ', width: 18, format: 'money', value: (customer: Customer) => customer.depositHeld } as const,
          ]
        : []),
      ...(showDebt ? [{ title: 'Còn phải thu', width: 16, format: 'money', value: (customer: Customer) => customer.debt } as const] : []),
      { title: 'Ghi chú', width: 30, value: (customer) => customer.note },
    ]
    try {
      await downloadExcel(`khach-hang-${new Date().toISOString().slice(0, 10)}.xlsx`, 'Khách hàng', columns, checked)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không xuất được tệp Excel.')
    } finally {
      setExporting(false)
    }
  }
  const totalBottles = totals?.bottlesHeld ?? 0
  const totalDeposit = totals?.depositHeld ?? 0
  const totalDebt = totals?.due ?? 0

  const archived = (archivedQuery.data ?? []).filter((customer) =>
    matchesSearch(query, `${customerCode(customer)} ${customer.name} ${customer.phone} ${customer.area}`, customer.phone),
  )
  const restore = (customer: Customer) =>
    activate.mutateAsync(customer.id).then(
      () => {
        message.success(`Đã khôi phục hồ sơ ${customer.name}.`)
      },
      (error: Error) => {
        message.error(error.message)
      },
    )
  const archivedColumns: TableColumnsType<Customer> = [
    {
      title: 'Khách hàng',
      dataIndex: 'name',
      minWidth: 260,
      render: (_, customer) => (
        <div className="af-cell-stack">
          <span className="af-name-with-tag">
            <span className="af-cell-truncate">{customer.name}</span>
            <Tag className="af-inactive-tag">Đã lưu trữ</Tag>
          </span>
          <small>{customerCode(customer)}</small>
        </div>
      ),
    },
    { title: 'Số điện thoại', dataIndex: 'phone', width: 160, render: (phone: string) => phone || '—' },
    { title: 'Khu vực', dataIndex: 'area', width: 160, render: (area: string) => area || '—' },
    {
      title: 'Thao tác',
      key: 'action',
      width: 90,
      render: (_, customer) => (
        <Dropdown
          trigger={['click']}
          menu={{
            items: [{ key: 'restore', label: 'Khôi phục hồ sơ', disabled: activate.isPending, onClick: () => void restore(customer) }],
          }}
        >
          <Button size="small" type="text" icon={<Ellipsis size={16} />} aria-label={`Thao tác khác với ${customer.name}`} />
        </Dropdown>
      ),
    },
  ]

  const unsupported = (title: string) => <Statistic title={title} valueRender={() => <Unsupported />} />
  const stats = [
    { key: 'count', node: <Statistic title="Khách hàng" value={totals?.customers ?? 0} /> },
    {
      key: 'debt',
      node: showDebt ? (
        <Statistic
          className={totalDebt > 0 ? 'af-stat-due' : 'af-stat-paid'}
          title="Còn phải thu"
          value={totalDebt}
          formatter={(value) => currency(Number(value))}
        />
      ) : (
        unsupported('Còn phải thu')
      ),
    },
    {
      key: 'bottles',
      node: showBottles ? <Statistic title="Vỏ khách đang giữ" value={totalBottles} suffix="vỏ" /> : unsupported('Vỏ khách đang giữ'),
    },
    {
      key: 'deposit',
      node: showBottles ? (
        <Statistic
          className="af-stat-deposit"
          title="Tiền cọc đang giữ"
          value={totalDeposit}
          formatter={(value) => currency(Number(value))}
        />
      ) : (
        unsupported('Tiền cọc đang giữ')
      ),
    },
  ]

  const columns: TableColumnsType<Customer> = [
    {
      ...sort.column('Khách hàng', 'name', 'text'),
      dataIndex: 'name',
      // Tên dài thì cắt "…" và hiện đủ khi rê chuột; phần dư của màn rộng dành cho cột địa chỉ.
      width: 200,
      sorter: (a, b) => a.name.localeCompare(b.name, 'vi'),
      render: (_, customer) => (
        <div className="af-cell-stack">
          <button
            type="button"
            className="af-link-button af-cell-truncate"
            title={`Xem hồ sơ ${customer.name}`}
            onClick={() => setProfileId(customer.id)}
          >
            {customer.name}
          </button>
          <small>
            {customer.phone ? <a href={`tel:${customer.phone.replace(/\s/g, '')}`}>{customer.phone}</a> : 'Chưa có số điện thoại'}
          </small>
        </div>
      ),
    },
    {
      title: 'Địa chỉ',
      key: 'address',
      minWidth: 246,
      render: (_, customer) => {
        const address = customer.mainAddress || (showArea ? customer.area : '')
        return address ? (
          <span className="af-cell-clamp" title={address}>
            {address}
          </span>
        ) : (
          <span className="af-text-muted">Chưa có địa chỉ</span>
        )
      },
    },
    {
      ...sort.column('Mua gần nhất', 'lastOrderAt', 'time'),
      dataIndex: 'lastOrderAt',
      width: 155,
      sorter: (a, b) => (a.lastOrderAt ?? '').localeCompare(b.lastOrderAt ?? ''),
      render: (at: string | undefined, customer) => (
        <div className="af-cell-stack">
          {at ? (
            <Tooltip title={dayjs(at).format('HH:mm DD/MM/YYYY')}>
              <span>{lastOrderLabel(at)}</span>
            </Tooltip>
          ) : (
            <span className="af-text-muted">{lastOrderLabel(at)}</span>
          )}
          {customer.orders > 0 && <small>{customer.orders} đơn</small>}
        </div>
      ),
    },
    showDebt
      ? {
          ...sort.column('Còn phải thu', 'debt', 'number'),
          dataIndex: 'debt',
          align: 'right',
          width: 150,
          sorter: (a, b) => a.debt - b.debt,
          render: (debt: number, customer) => <CustomerDebt debt={debt} orders={customer.orders} />,
        }
      : { title: 'Còn phải thu', key: 'debt', align: 'right', width: 150, render: () => <Unsupported /> },
    showBottles
      ? {
          ...sort.column('Vỏ đang giữ', 'bottlesHeld', 'number'),
          dataIndex: 'bottlesHeld',
          width: 145,
          sorter: (a, b) => a.bottlesHeld - b.bottlesHeld,
          render: (count: number, customer) => (
            <div className="af-cell-stack">
              <span>
                <Tag color={count > 0 ? 'orange' : undefined}>{count} vỏ</Tag>
              </span>
              {customer.depositHeld > 0 && <small>Cọc {currency(customer.depositHeld)}</small>}
            </div>
          ),
        }
      : { title: 'Vỏ đang giữ', key: 'bottlesHeld', width: 145, render: () => <Unsupported /> },
    {
      title: 'Thao tác',
      key: 'action',
      width: 130,
      fixed: 'right',
      render: (_, customer) => (
        <span className="af-row-actions">
          <ViewButton title="Xem hồ sơ" subject={customer.name} onClick={() => setProfileId(customer.id)} />
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
                  { value: 'active', label: <CountLabel label="Đang hoạt động" count={totals?.customers ?? 0} tone="success" /> },
                  {
                    value: 'archived',
                    label: canReactivate ? (
                      <CountLabel label="Đã lưu trữ" count={archivedQuery.data?.length ?? 0} tone="danger" />
                    ) : (
                      <Tooltip title="Backend chưa hỗ trợ xem khách đã lưu trữ">
                        <span>
                          <ToneLabel tone="danger">Đã lưu trữ</ToneLabel>
                        </span>
                      </Tooltip>
                    ),
                    disabled: !canReactivate,
                  },
                ]}
              />
              <Input
                allowClear
                prefix={<Search size={16} className="af-input-icon" />}
                placeholder="Tìm mã, tên, số điện thoại, địa chỉ..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="af-search"
              />
              {view === 'active' && (
                <Select<IdleFilter>
                  aria-label="Lọc theo lần mua gần nhất"
                  className={`af-customer-idle ${filterOn(idle !== 'all')}`}
                  value={idle}
                  onChange={setIdle}
                  options={idleOptions}
                />
              )}
            </div>
            {view === 'archived' ? (
              archivedQuery.isError ? (
                <QueryError error={archivedQuery.error} onRetry={archivedQuery.refetch} />
              ) : (
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
            ) : narrow ? (
              <CustomerCards
                customers={visible}
                loading={customersQuery.isPending}
                emptyText={filtered ? 'Không tìm thấy khách hàng phù hợp.' : 'Chưa có khách hàng nào.'}
                onProfile={setProfileId}
                onCreateOrder={setOrderFor}
                sort={cardSort}
                onSortChange={setCardSort}
                server={server}
              />
            ) : (
              <>
                <BulkBar count={checked.length} noun="khách" onClear={() => setCheckedState({ filterKey, customers: [] })}>
                  <Button icon={<FileSpreadsheet size={16} />} loading={exporting} onClick={() => void exportChecked()}>
                    Xuất Excel
                  </Button>
                </BulkBar>
                <Table<Customer>
                  className="af-data-table af-table-flush"
                  size="middle"
                  rowKey="id"
                  columns={columns}
                  dataSource={visible}
                  loading={customersQuery.isPending}
                  pagination={serverTablePagination(server)}
                  locale={{ emptyText: filtered ? 'Không tìm thấy khách hàng phù hợp.' : 'Chưa có khách hàng nào.' }}
                  scroll={{ x: 1074, y: tableScrollHeight }}
                  rowSelection={{
                    selectedRowKeys: checked.map((customer) => customer.id),
                    preserveSelectedRowKeys: true,
                    onChange: (keys) => setCheckedIds(keys.map(String)),
                    fixed: 'left',
                    columnWidth: 44,
                  }}
                />
              </>
            )}
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
      {orderFor && <OrderIntakeModal key={orderFor.id} defaultCustomer={orderFor} onClose={() => setOrderFor(null)} />}
      <LiveReceivables />
      <LiveBottleOverview />
    </Page>
  )
}
