import { useState } from 'react'
import { Button, Card, Input, Select } from 'antd'
import { Plus, Search } from 'lucide-react'
import { CountLabel } from '../../shared/components/CountLabel'
import { Page } from '../../shared/components/Page'
import { QueryError } from '../../shared/components/QueryError'
import { CreateOrderModal } from './components/CreateOrderModal'
import { OrdersTable } from './components/OrdersTable'
import { orderStatuses } from './orderStatus'
import { useOrders } from './useOrders'
import { amountDue } from './types'

const ALL = 'Tất cả'

export function OrdersPage() {
  const ordersQuery = useOrders()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<string>(ALL)
  const [creating, setCreating] = useState(false)
  const [method, setMethod] = useState(ALL)
  const [payment, setPayment] = useState(ALL)

  const orders = ordersQuery.data ?? []
  const countOf = (value: string) => (value === ALL ? orders.length : orders.filter((order) => order.status === value).length)
  const keyword = query.trim().toLowerCase()
  const visible = orders.filter(
    (order) =>
      (status === ALL || order.status === status) &&
      (method === ALL || order.method === method) &&
      (payment === ALL || (order.status !== 'Đã hủy' && (payment === 'Còn phải thu' ? amountDue(order) > 0 : amountDue(order) === 0))) &&
      `${order.id} ${order.customer} ${order.phone} ${order.items}`.toLowerCase().includes(keyword),
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
            <div className="af-toolbar">
              <div className="af-order-filters">
                <Select
                  aria-label="Lọc trạng thái đơn"
                  style={{ minWidth: 205 }}
                  value={status}
                  onChange={(value) => setStatus(String(value))}
                  options={[ALL, ...orderStatuses].map((value) => ({
                    value,
                    label: <CountLabel label={value} count={countOf(value)} urgent={value === 'Chờ xác nhận'} />,
                  }))}
                />
                <Select
                  aria-label="Lọc hình thức nhận"
                  value={method}
                  onChange={setMethod}
                  style={{ minWidth: 160 }}
                  options={[{ value: ALL, label: 'Mọi hình thức nhận' }, ...['Tại quầy', 'Giao tận nơi'].map((value) => ({ value, label: value }))]}
                />
                <Select
                  aria-label="Lọc thanh toán"
                  value={payment}
                  onChange={setPayment}
                  style={{ minWidth: 165 }}
                  options={[{ value: ALL, label: 'Mọi thanh toán' }, ...['Còn phải thu', 'Đã thanh toán'].map((value) => ({ value, label: value }))]}
                />
              </div>
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
              emptyText={
                keyword || status !== ALL || method !== ALL || payment !== ALL ? 'Không có đơn phù hợp. Thử đổi từ khóa hoặc bộ lọc.' : 'Chưa có đơn hàng nào.'
              }
            />
          </>
        )}
      </Card>
      <CreateOrderModal open={creating} onClose={() => setCreating(false)} />
    </Page>
  )
}
