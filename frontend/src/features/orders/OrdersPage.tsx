import { useMemo, useState } from 'react'
import { ToneLabel } from '@/shared/components/ToneLabel'
import { filterOn } from '@/shared/utils/filterOn'
import { Button, Card, Grid, Input, Segmented, Select } from 'antd'
import { FunnelX, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { CountLabel } from '@/shared/components/CountLabel'
import { Page } from '@/shared/components/Page'
import { QueryError } from '@/shared/components/QueryError'
import { OrderDetails } from './components/OrderDetails'
import { OrderIntakeModal } from './components/OrderIntakeModal'
import { OrdersTable } from './components/OrdersTable'
import { useOrderPage, useOrderStatusCounts } from './orderData'
import { orderStatuses as statuses } from './orderStatus'
import { inOrderGroup, orderGroups, statusesInGroup, type OrderGroupKey } from './orderGroups'
import type { OrderStatus } from './types'
import { ALL_ORDERS as ALL, useOrderFilters } from './useOrderFilters'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import { tablePagination, type ServerPagination } from '@/shared/utils/table'

export function OrdersPage() {
  const countsQuery = useOrderStatusCounts()
  const {
    filters: { query, group, status, method, payment },
    updateFilters,
  } = useOrderFilters()
  const [creating, setCreating] = useState(false)
  // Điện thoại: chỉ hiện lọc trạng thái và tìm kiếm, hai bộ lọc còn lại gom vào nút "Lọc thêm" để đơn hiện sớm hơn.
  const narrow = Grid.useBreakpoint().md === false
  const [moreFilters, setMoreFilters] = useState(false)
  const extraActive = Number(status !== ALL) + Number(method !== ALL) + Number(payment !== ALL)
  const [created, setCreated] = useState<string | null>(null)

  const counts = countsQuery.data ?? {}
  const countOf = (value: OrderStatus) => counts[value] ?? 0
  const countGroup = (key: OrderGroupKey) => statuses.filter((value) => inOrderGroup(key, value)).reduce((sum, value) => sum + countOf(value), 0)
  // Chưa chọn nhóm: mở thẳng việc cần làm; hết việc thì xem tất cả.
  const activeGroup: OrderGroupKey = group || (countGroup('need') > 0 ? 'need' : 'all')
  const groupStatuses = statusesInGroup(activeGroup, statuses)
  const statusValue = groupStatuses.includes(status as never) ? status : ALL
  const statusOptions = [
    { value: ALL, label: 'Mọi trạng thái' },
    ...groupStatuses.map((value) => ({ value, label: `${value} (${countOf(value)})` })),
  ]
  const paymentFilter = payment
  const hasFilters = Boolean(query.trim() || statusValue !== ALL || method !== ALL || paymentFilter !== ALL)
  // Xóa bộ lọc giữ nguyên nhóm đang xem.
  const resetFilters = () => updateFilters({ query: '', status: ALL, method: ALL, payment: ALL })
  // Nhóm lịch sử tìm ở BE: chờ ngừng gõ rồi mới gửi.
  const searched = useDebouncedValue(query)
  const listFilters = useMemo(
    () => ({ query: searched, group: activeGroup, status: statusValue, method, payment: paymentFilter }),
    [searched, activeGroup, statusValue, method, paymentFilter],
  )
  const filterKey = JSON.stringify(listFilters)
  // Đổi bộ lọc thì về trang đầu; cỡ trang giữ nguyên.
  const [paging, setPaging] = useState({ filterKey, page: 0, size: tablePagination.defaultPageSize ?? 10 })
  const page = paging.filterKey === filterKey ? paging.page : 0
  const listQuery = useOrderPage(listFilters, page, paging.size)
  const visible = listQuery.data?.orders ?? []
  const server: ServerPagination | undefined = listQuery.data?.serverPaged
    ? { page, size: paging.size, total: listQuery.data.total, onChange: (next, size) => setPaging({ filterKey, page: next, size }) }
    : undefined
  const failed = countsQuery.isError ? countsQuery : listQuery.isError ? listQuery : undefined
  const loading = countsQuery.isPending || listQuery.isPending

  return (
    <Page
      title="Đơn hàng"
      actions={
        <Button type="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>
          Tạo đơn hàng
        </Button>
      }
    >
      <Card className="af-card" styles={{ body: { padding: 0 } }}>
        {failed ? (
          <QueryError error={failed.error ?? new Error('Không tải được danh sách đơn hàng.')} onRetry={failed.refetch} />
        ) : (
          <>
            {/* 4 nhóm theo việc cần làm, cùng kiểu thanh lọc với các trang khác; trạng thái chi tiết lọc trong ô chọn. Điện thoại: 4 ô chia đều, số ở trên, tên ở dưới. */}
            <div className="af-order-groups">
              <Segmented<OrderGroupKey>
                block={narrow}
                aria-label="Nhóm đơn hàng"
                value={activeGroup}
                onChange={(value) => updateFilters({ group: value, status: ALL })}
                options={orderGroups.map(({ key, label, tone }) => {
                  const count = countGroup(key)
                  return {
                    value: key,
                    label: narrow ? (
                      <ToneLabel tone={tone}>
                        <span className="af-order-group">
                          <strong className={key === 'need' && count > 0 ? 'is-urgent' : undefined}>{count}</strong>
                          <small>{label}</small>
                        </span>
                      </ToneLabel>
                    ) : (
                      <CountLabel label={label} count={count} urgent={key === 'need'} tone={tone} />
                    ),
                  }
                })}
              />
            </div>
            <div className="af-toolbar">
              <div className="af-order-filters">
                {narrow && (
                  <Button
                    icon={<SlidersHorizontal size={16} />}
                    aria-expanded={moreFilters}
                    onClick={() => setMoreFilters((open) => !open)}
                  >
                    Lọc thêm{extraActive ? ` (${extraActive})` : ''}
                  </Button>
                )}
                {(!narrow || moreFilters) && (
                  <>
                    {groupStatuses.length > 1 && (
                      <Select
                        aria-label="Lọc trạng thái trong nhóm"
                        className={filterOn(statusValue !== ALL)}
                        style={{ minWidth: 190 }}
                        value={statusValue}
                        onChange={(value) => updateFilters({ status: String(value) })}
                        options={statusOptions}
                      />
                    )}
                    <Select
                      aria-label="Lọc hình thức nhận"
                      className={filterOn(method !== ALL)}
                      value={method}
                      onChange={(value) => updateFilters({ method: value })}
                      style={{ minWidth: 160 }}
                      options={[
                        { value: ALL, label: 'Mọi hình thức nhận' },
                        ...['Tại quầy', 'Giao tận nơi'].map((value) => ({ value, label: value })),
                      ]}
                    />
                    <Select
                      aria-label="Lọc thanh toán"
                      className={filterOn(paymentFilter !== ALL)}
                      value={paymentFilter}
                      onChange={(value) => updateFilters({ payment: value })}
                      style={{ minWidth: 165 }}
                      options={[
                        { value: ALL, label: 'Mọi thanh toán' },
                        ...['Còn phải thu', 'Đã thanh toán'].map((value) => ({ value, label: value })),
                      ]}
                    />
                  </>
                )}
              </div>
              <Input
                allowClear
                prefix={<Search size={16} className="af-input-icon" />}
                placeholder="Tìm mã đơn, tên khách, số điện thoại..."
                aria-label="Tìm đơn hàng"
                value={query}
                onChange={(event) => updateFilters({ query: event.target.value })}
                className={`af-search ${filterOn(Boolean(query.trim()))}`}
              />
            </div>
            <div className="af-filter-summary">
              <span role="status">
                {loading ? 'Đang tải đơn hàng…' : `${listQuery.data?.total ?? 0} / ${countGroup(activeGroup)} đơn hàng`}
              </span>
              {hasFilters && (
                <Button type="link" size="small" className="af-clear-filter" icon={<FunnelX size={14} />} onClick={resetFilters}>
                  Xóa bộ lọc
                </Button>
              )}
            </div>
            <OrdersTable
              filterKey={filterKey}
              orders={visible}
              loading={loading}
              server={server}
              emptyText={
                hasFilters
                  ? 'Không có đơn phù hợp. Thử đổi từ khóa hoặc xóa bộ lọc.'
                  : activeGroup === 'need'
                    ? 'Không còn đơn nào cần xử lý.'
                    : activeGroup === 'all'
                      ? 'Chưa có đơn hàng nào.'
                      : 'Không có đơn nào trong nhóm này.'
              }
            />
          </>
        )}
      </Card>
      {creating && <OrderIntakeModal onClose={() => setCreating(false)} onCreated={setCreated} />}
      {created !== null && <OrderDetails id={created} onClose={() => setCreated(null)} />}
    </Page>
  )
}
