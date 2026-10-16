import { useState } from 'react'
import { Button, Card, Input, Segmented } from 'antd'
import { Plus, Search } from 'lucide-react'
import { Page } from '../../shared/components/Page'
import { QueryError } from '../../shared/components/QueryError'
import { CreateOrderModal } from './components/CreateOrderModal'
import { OrdersTable } from './components/OrdersTable'
import { orderStatuses } from './orderStatus'
import { useOrders } from './useOrders'

const ALL = 'Tất cả'

export function OrdersPage() {
  const ordersQuery = useOrders()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<string>(ALL)
  const [creating, setCreating] = useState(false)

  const orders = ordersQuery.data ?? []
  const countOf = (value: string) => (value === ALL ? orders.length : orders.filter((order) => order.status === value).length)
  const keyword = query.trim().toLowerCase()
  const visible = orders.filter(
    (order) =>
      (status === ALL || order.status === status) &&
      `${order.id} ${order.customer} ${order.phone} ${order.items}`.toLowerCase().includes(keyword),
  )

  return (
    <Page
      title="Đơn hàng"
      description="Tiếp nhận, chuẩn bị và theo dõi đơn hàng."
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
            <div className="af-toolbar">
              <Segmented
                value={status}
                onChange={(value) => setStatus(String(value))}
                options={[ALL, ...orderStatuses].map((value) => ({ value, label: `${value} (${countOf(value)})` }))}
              />
              <Input
                allowClear
                prefix={<Search size={16} className="af-input-icon" />}
                placeholder="Tìm mã đơn, tên khách, số điện thoại..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="af-search"
              />
            </div>
            <OrdersTable
              orders={visible}
              loading={ordersQuery.isPending}
              emptyText={keyword || status !== ALL ? 'Không có đơn phù hợp. Thử đổi từ khóa hoặc trạng thái.' : 'Chưa có đơn hàng nào.'}
            />
          </>
        )}
      </Card>
      <CreateOrderModal open={creating} onClose={() => setCreating(false)} />
    </Page>
  )
}
