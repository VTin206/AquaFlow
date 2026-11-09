import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Card, Descriptions, Empty, Result, Select, Skeleton, Space, Table, Tag } from 'antd'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '@/features/auth/useAuth'
import { isCustomer } from '@/features/auth/accountAccess'
import { orderStatusLabels } from '@/features/live/orderApi'
import { catalogApi } from '@/features/live/catalogApi'
import { ApiError } from '@/shared/api/client'
import { QueryError } from '@/shared/components/QueryError'
import { currency } from '@/shared/utils/format'
import { OrderProgress } from '@/features/orders/OrderProgress'
import { customerOrderApi } from './customerOrderApi'
import { demoCustomerOrderApi, type CustomerOrder } from './demoCustomerData'
const time = (value: string | null) => (value ? new Date(value).toLocaleString('vi-VN') : '—')

export function CustomerOrdersPage() {
  const { user } = useAuth()
  const [status, setStatus] = useState<string>('ALL')
  const query = useQuery({
    queryKey: ['live', 'customer-orders', user?.email],
    queryFn: (): Promise<CustomerOrder[]> => (user?.isDemo ? demoCustomerOrderApi.list() : customerOrderApi.list()),
    enabled: isCustomer(user) || Boolean(user?.isDemo),
    refetchInterval: 30000,
  })
  const orders = [...(query.data ?? [])]
    .filter((order) => status === 'ALL' || order.status === status)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
  return (
    <div className="af-shop-page">
      <h1>Đơn hàng của tôi</h1>
      <p>Xem đơn đã đặt bằng tài khoản này và trạng thái giao hàng mới nhất.</p>
      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          aria-label="Lọc trạng thái đơn hàng"
          style={{ minWidth: 210 }}
          value={status}
          onChange={setStatus}
          options={[
            { value: 'ALL', label: 'Tất cả trạng thái' },
            ...Object.entries(orderStatusLabels).map(([value, label]) => ({ value, label })),
          ]}
        />
        <Button loading={query.isFetching} onClick={() => void query.refetch()}>
          Làm mới
        </Button>
        <Link to="/shop">
          <Button>Mua thêm</Button>
        </Link>
      </Space>
      {query.isError ? (
        <QueryError error={query.error} onRetry={query.refetch} />
      ) : query.isPending ? (
        <Skeleton active />
      ) : !orders.length ? (
        <Card>
          <Empty description={query.data.length ? 'Không có đơn ở trạng thái này.' : 'Bạn chưa có đơn hàng nào.'} />
        </Card>
      ) : (
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          {orders.map((order) => (
            <Card
              key={order.id}
              title={order.orderCode}
              extra={<Tag color={order.status === 'DELIVERED' ? 'green' : 'blue'}>{orderStatusLabels[order.status]}</Tag>}
            >
              <p>
                Đặt lúc {time(order.createdAt)} · {currency(order.total)}
              </p>
              <p>{order.deliveryAddress || 'Nhận tại cửa hàng'}</p>
              <Link to={`/shop/orders/${order.id}`}>
                <Button type="primary">Xem chi tiết</Button>
              </Link>
            </Card>
          ))}
        </Space>
      )}
    </div>
  )
}

export function CustomerOrderPage() {
  const { id: rawId } = useParams()
  const id = Number(rawId)
  const valid = /^\d+$/.test(rawId ?? '') && Number.isSafeInteger(id) && id > 0
  const { user } = useAuth()
  const query = useQuery({
    queryKey: ['live', 'customer-order', user?.email, id],
    queryFn: (): Promise<CustomerOrder> => (user?.isDemo ? demoCustomerOrderApi.detail(id) : customerOrderApi.detail(id)),
    enabled: valid && (isCustomer(user) || Boolean(user?.isDemo)),
    retry: false,
    refetchInterval: 15000,
  })
  const catalog = useQuery({
    queryKey: ['shop', 'order-products', 'live'],
    queryFn: catalogApi.products,
    enabled: valid && isCustomer(user) && !user?.isDemo,
  })
  const notFound = !valid || (query.error instanceof ApiError && [403, 404].includes(query.error.status))
  if (notFound)
    return (
      <Result
        status="404"
        title="Không tìm thấy đơn hàng"
        subTitle="Đơn không tồn tại hoặc không thuộc tài khoản của bạn."
        extra={
          <Link to="/shop/orders">
            <Button>Đơn hàng của tôi</Button>
          </Link>
        }
      />
    )
  return (
    <div className="af-shop-page">
      <Space style={{ marginBottom: 16 }}>
        <Link to="/shop/orders">
          <Button>Đơn hàng của tôi</Button>
        </Link>
        <Button loading={query.isFetching} onClick={() => void query.refetch()}>
          Làm mới
        </Button>
      </Space>
      {query.isError ? (
        <QueryError error={query.error} onRetry={query.refetch} />
      ) : query.isPending ? (
        <Skeleton active />
      ) : (
        <CustomerOrderContent order={query.data} products={catalog.data ?? []} />
      )}
      {catalog.isError && (
        <Alert
          type="warning"
          title="Không tải được tên sản phẩm; đang hiển thị mã sản phẩm."
          action={<Button onClick={() => void catalog.refetch()}>Thử lại</Button>}
        />
      )}
    </div>
  )
}

function CustomerOrderContent({ order, products }: { order: CustomerOrder; products: Awaited<ReturnType<typeof catalogApi.products>> }) {
  return (
    <Card title={`Đơn ${order.orderCode}`}>
      <OrderProgress order={order} />
      <Descriptions
        column={{ xs: 1, sm: 2 }}
        items={[
          { key: 'name', label: 'Người nhận', children: order.recipientName || '—' },
          { key: 'phone', label: 'Điện thoại', children: order.recipientPhone || '—' },
          { key: 'address', label: 'Địa chỉ', children: order.deliveryAddress || 'Nhận tại cửa hàng' },
          { key: 'created', label: 'Ngày đặt', children: time(order.createdAt) },
          { key: 'confirmed', label: 'Xác nhận lúc', children: time(order.confirmedAt) },
          { key: 'requested', label: 'Giờ giao đã hẹn', children: time(order.requestedDeliveryAt) },
          { key: 'note', label: 'Ghi chú', children: order.note || '—' },
        ]}
      />
      <Table
        rowKey="id"
        pagination={false}
        dataSource={order.items}
        scroll={{ x: 500 }}
        columns={[
          {
            title: 'Sản phẩm',
            dataIndex: 'productId',
            render: (id: number, row) => row.productName ?? products.find((p) => p.id === id)?.name ?? `Sản phẩm #${id}`,
          },
          { title: 'Số lượng', dataIndex: 'quantity' },
          { title: 'Đơn giá', dataIndex: 'unitPrice', render: currency },
          { title: 'Thành tiền', dataIndex: 'lineTotal', render: currency },
        ]}
      />
      <p>
        Tiền hàng: {currency(order.subtotal)} · Giảm giá: {currency(order.discountAmount)} · Phí giao: {currency(order.deliveryFee)}
      </p>
      <strong>Tổng cộng: {currency(order.total)}</strong>
    </Card>
  )
}
