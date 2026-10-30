import { useState } from 'react'
import { Alert, Button, Card, Input, Select } from 'antd'
import { Plus, RotateCcw, Search } from 'lucide-react'
import { CountLabel } from '../../shared/components/CountLabel'
import { Page } from '../../shared/components/Page'
import { QueryError } from '../../shared/components/QueryError'
import { useFeature, useIsDemo } from '../../shared/features'
import { LiveOrderDetails } from '../live/LiveOrderDetails'
import { LiveOrderDraftModal } from '../live/LiveOrderDraftModal'
import { CreateOrderModal } from './components/CreateOrderModal'
import { OrdersTable } from './components/OrdersTable'
import { statusesFor } from './orderStatus'
import { useOrderList } from './orderData'
import { amountDue } from './types'
import { ALL_ORDERS as ALL, useOrderFilters } from './useOrderFilters'
import { matchesSearch } from '../../shared/utils/search'

export function OrdersPage() {
  const demo = useIsDemo()
  const showPayments = useFeature('orderPayments')
  const ordersQuery = useOrderList()
  const { filters: { query, status, method, payment }, updateFilters, resetFilters } = useOrderFilters()
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<number | null>(null)

  const orders = ordersQuery.data ?? []
  const statuses = statusesFor(demo)
  const countOf = (value: string) => (value === ALL ? orders.length : orders.filter((order) => order.status === value).length)
  const pending = countOf('Chờ xác nhận')
  // Bộ lọc thanh toán đã lưu từ bản dùng thử bị bỏ qua khi BE chưa có phiếu thu.
  const paymentFilter = showPayments ? payment : ALL
  const hasFilters = Boolean(query.trim() || status !== ALL || method !== ALL || paymentFilter !== ALL)
  const visible = orders.filter(
    (order) =>
      (status === ALL || order.status === status) &&
      (method === ALL || order.method === method) &&
      (paymentFilter === ALL || (order.status !== 'Đã hủy' && (paymentFilter === 'Còn phải thu' ? amountDue(order) > 0 : amountDue(order) === 0))) &&
      matchesSearch(query, `${order.code ?? order.id} ${order.customer} ${order.phone} ${order.items}`, order.phone),
  )

  return (
    <Page
      title="Đơn hàng"
      description={showPayments ? 'Tiếp nhận tại quầy, điện thoại hoặc tin nhắn; theo dõi giao nhận và thanh toán riêng.' : 'Tiếp nhận tại quầy, điện thoại, tin nhắn và website; xác nhận để giữ hàng trong kho.'}
      actions={
        <Button type="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>
          Tạo đơn hàng
        </Button>
      }
    >
      {!demo && pending > 0 && status !== 'Chờ xác nhận' && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          title={`Có ${pending} đơn đang chờ xác nhận.`}
          action={<Button size="small" onClick={() => updateFilters({ status: 'Chờ xác nhận' })}>Xem đơn chờ</Button>}
        />
      )}
      <Card className="af-card" styles={{ body: { padding: 0 } }}>
        {ordersQuery.isError ? (
          <QueryError error={ordersQuery.error} onRetry={ordersQuery.refetch} />
        ) : (
          <>
            <div className="af-toolbar">
              <div className="af-order-filters">
                <Select
                  aria-label="Lọc trạng thái đơn"
                  style={{ minWidth: 205 }}
                  value={statuses.includes(status as never) ? status : ALL}
                  onChange={(value) => updateFilters({ status: String(value) })}
                  options={[ALL, ...statuses].map((value) => ({
                    value,
                    label: <CountLabel label={value} count={countOf(value)} urgent={value === 'Chờ xác nhận'} />,
                  }))}
                />
                <Select
                  aria-label="Lọc hình thức nhận"
                  value={method}
                  onChange={(value) => updateFilters({ method: value })}
                  style={{ minWidth: 160 }}
                  options={[{ value: ALL, label: 'Mọi hình thức nhận' }, ...['Tại quầy', 'Giao tận nơi'].map((value) => ({ value, label: value }))]}
                />
                {showPayments && (
                  <Select
                    aria-label="Lọc thanh toán"
                    value={payment}
                    onChange={(value) => updateFilters({ payment: value })}
                    style={{ minWidth: 165 }}
                    options={[{ value: ALL, label: 'Mọi thanh toán' }, ...['Còn phải thu', 'Đã thanh toán'].map((value) => ({ value, label: value }))]}
                  />
                )}
              </div>
              <Input
                allowClear
                prefix={<Search size={16} className="af-input-icon" />}
                placeholder="Tìm mã đơn, tên khách, số điện thoại..."
                aria-label="Tìm đơn hàng"
                value={query}
                onChange={(event) => updateFilters({ query: event.target.value })}
                className="af-search"
              />
            </div>
            <div className="af-filter-summary">
              <span role="status">{ordersQuery.isPending ? 'Đang tải đơn hàng…' : `${visible.length} / ${orders.length} đơn hàng`}</span>
              {hasFilters && <Button type="link" size="small" icon={<RotateCcw size={14} />} onClick={resetFilters}>Xóa bộ lọc</Button>}
            </div>
            <OrdersTable
              filterKey={JSON.stringify([query, status, method, paymentFilter])}
              orders={visible}
              loading={ordersQuery.isPending}
              emptyText={
                hasFilters ? 'Không có đơn phù hợp. Thử đổi từ khóa hoặc xóa bộ lọc.' : 'Chưa có đơn hàng nào.'
              }
            />
          </>
        )}
      </Card>
      {demo ? (
        <CreateOrderModal open={creating} onClose={() => setCreating(false)} />
      ) : (
        creating && <LiveOrderDraftModal onClose={() => setCreating(false)} onCreated={(order) => { setCreating(false); setCreated(order.id) }} />
      )}
      {created !== null && <LiveOrderDetails key={created} id={created} onClose={() => setCreated(null)} />}
    </Page>
  )
}
