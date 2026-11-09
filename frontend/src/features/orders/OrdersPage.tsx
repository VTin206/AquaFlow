import { useState } from 'react'
import { ToneLabel } from '@/shared/components/ToneLabel'
import { filterOn } from '@/shared/utils/filterOn'
import { Button, Card, Grid, Input, Segmented, Select, Tooltip } from 'antd'
import { FunnelX, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { CountLabel } from '@/shared/components/CountLabel'
import { Page } from '@/shared/components/Page'
import { QueryError } from '@/shared/components/QueryError'
import { useFeature } from '@/shared/features'
import { OrderDetails } from './components/OrderDetails'
import { OrderIntakeModal } from './components/OrderIntakeModal'
import { OrdersTable } from './components/OrdersTable'
import { useOrderList } from './orderData'
import { orderStatuses as statuses } from './orderStatus'
import { inOrderGroup, orderGroups, statusesInGroup, type OrderGroupKey } from './orderGroups'
import { amountDue } from './types'
import { ALL_ORDERS as ALL, useOrderFilters } from './useOrderFilters'
import { matchesSearch } from '@/shared/utils/search'

export function OrdersPage() {
  const showPayments = useFeature('orderPayments')
  const ordersQuery = useOrderList()
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

  const orders = ordersQuery.data ?? []
  const countGroup = (key: OrderGroupKey) => orders.filter((order) => inOrderGroup(key, order.status)).length
  // Chưa chọn nhóm: mở thẳng việc cần làm; hết việc thì xem tất cả.
  const activeGroup: OrderGroupKey = group || (countGroup('need') > 0 ? 'need' : 'all')
  const groupStatuses = statusesInGroup(activeGroup, statuses)
  const statusValue = groupStatuses.includes(status as never) ? status : ALL
  const statusOptions = [
    { value: ALL, label: 'Mọi trạng thái' },
    ...groupStatuses.map((value) => ({ value, label: `${value} (${orders.filter((order) => order.status === value).length})` })),
  ]
  // Bộ lọc thanh toán đã lưu từ bản dùng thử bị bỏ qua khi BE chưa có phiếu thu.
  const paymentFilter = showPayments ? payment : ALL
  const hasFilters = Boolean(query.trim() || statusValue !== ALL || method !== ALL || paymentFilter !== ALL)
  // Xóa bộ lọc giữ nguyên nhóm đang xem.
  const resetFilters = () => updateFilters({ query: '', status: ALL, method: ALL, payment: ALL })
  const visible = orders.filter(
    (order) =>
      inOrderGroup(activeGroup, order.status) &&
      (statusValue === ALL || order.status === statusValue) &&
      (method === ALL || order.method === method) &&
      (paymentFilter === ALL ||
        (order.status !== 'Đã hủy' && (paymentFilter === 'Còn phải thu' ? amountDue(order) > 0 : amountDue(order) === 0))) &&
      matchesSearch(query, `${order.code ?? order.id} ${order.customer} ${order.phone} ${order.items}`, order.phone),
  )

  return (
    <Page
      title="Đơn hàng"
      description="Tiếp nhận tại quầy, điện thoại hoặc tin nhắn; theo dõi giao nhận và thanh toán riêng."
      actions={
        <Button type="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>
          Tạo đơn hàng
        </Button>
      }
    >
      <Card className="af-card" styles={{ body: { padding: 0 } }}>
        {ordersQuery.isError ? (
          <QueryError error={ordersQuery.error} onRetry={ordersQuery.refetch} />
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
                    <Tooltip title={showPayments ? undefined : 'Backend chưa hỗ trợ phiếu thu'}>
                      <Select
                        aria-label="Lọc thanh toán"
                        className={filterOn(paymentFilter !== ALL)}
                        value={paymentFilter}
                        disabled={!showPayments}
                        onChange={(value) => updateFilters({ payment: value })}
                        style={{ minWidth: 165 }}
                        options={[
                          { value: ALL, label: showPayments ? 'Mọi thanh toán' : 'Thanh toán (chưa hỗ trợ)' },
                          ...['Còn phải thu', 'Đã thanh toán'].map((value) => ({ value, label: value })),
                        ]}
                      />
                    </Tooltip>
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
                {ordersQuery.isPending ? 'Đang tải đơn hàng…' : `${visible.length} / ${countGroup(activeGroup)} đơn hàng`}
              </span>
              {hasFilters && (
                <Button type="link" size="small" className="af-clear-filter" icon={<FunnelX size={14} />} onClick={resetFilters}>
                  Xóa bộ lọc
                </Button>
              )}
            </div>
            <OrdersTable
              filterKey={JSON.stringify([query, activeGroup, statusValue, method, paymentFilter])}
              orders={visible}
              loading={ordersQuery.isPending}
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
