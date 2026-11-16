import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Card, Empty, Pagination, Popconfirm, Result, Select, Skeleton, Tag } from 'antd'
import { ArrowLeft, ChevronRight, Phone, RefreshCw, ShoppingBag } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '@/features/auth/useAuth'
import { isCustomer } from '@/features/auth/accountAccess'
import { orderStatusLabels, paymentStatusLabels, type LiveOrder } from '@/features/live/orderApi'
import { catalogApi } from '@/features/live/catalogApi'
import { OrderProgress } from '@/features/orders/OrderProgress'
import { statusColor } from '@/features/orders/orderStatus'
import type { OrderStatus as StaffOrderStatus } from '@/features/orders/types'
import { ApiError } from '@/shared/api/client'
import { Money } from '@/shared/components/Money'
import { QueryError } from '@/shared/components/QueryError'
import { currency } from '@/shared/utils/format'
import { customerOrderApi } from './customerOrderApi'
import { useShopContact } from './shopService'

type Products = Awaited<ReturnType<typeof catalogApi.products>>
const PAGE_SIZE = 10
const time = (value: string | null) =>
  value
    ? new Date(value).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—'
const productName = (products: Products, id: number) => products.find((product) => product.id === id)?.name ?? `Sản phẩm #${id}`
const StatusTag = ({ status }: { status: LiveOrder['status'] }) => (
  <Tag color={statusColor[orderStatusLabels[status] as StaffOrderStatus]}>{orderStatusLabels[status]}</Tag>
)
/** Tên sản phẩm của khách dùng chung một cache cho danh sách và chi tiết đơn. */
const useOrderProducts = (enabled: boolean) =>
  useQuery({ queryKey: ['shop', 'order-products', 'live'], queryFn: catalogApi.products, enabled, staleTime: 60_000 })

/** "Bình 20L × 2 và 1 sản phẩm khác"; chưa tải được tên thì chỉ nêu số sản phẩm. */
function itemSummary(order: LiveOrder, products: Products | undefined) {
  const [first, ...rest] = order.items
  if (!first) return ''
  if (!products) return `${order.items.length} sản phẩm`
  const lead = `${productName(products, first.productId)} × ${first.quantity}`
  return rest.length ? `${lead} và ${rest.length} sản phẩm khác` : lead
}

export function CustomerOrdersPage() {
  const { user } = useAuth()
  const [status, setStatus] = useState<string>('ALL')
  const [page, setPage] = useState(1)
  const query = useQuery({
    queryKey: ['live', 'customer-orders', user?.email],
    queryFn: customerOrderApi.list,
    enabled: isCustomer(user),
    refetchInterval: 30000,
  })
  const catalog = useOrderProducts(isCustomer(user))
  const orders = [...(query.data ?? [])]
    .filter((order) => status === 'ALL' || order.status === status)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
  // Đơn bị lọc bớt hoặc hủy làm hụt trang thì lùi về trang cuối còn dữ liệu.
  const current = Math.min(page, Math.max(1, Math.ceil(orders.length / PAGE_SIZE)))
  const visible = orders.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)
  return (
    <div className="af-shop-page af-shop-account-page">
      <h1>Đơn hàng của tôi</h1>
      <div className="af-shop-orders-bar">
        <Select
          aria-label="Lọc trạng thái đơn hàng"
          value={status}
          onChange={(value) => {
            setStatus(value)
            setPage(1)
          }}
          options={[
            { value: 'ALL', label: 'Tất cả trạng thái' },
            ...Object.entries(orderStatusLabels).map(([value, label]) => ({ value, label })),
          ]}
        />
        <Button icon={<RefreshCw size={16} />} loading={query.isFetching} onClick={() => void query.refetch()}>
          Làm mới
        </Button>
        <Link to="/shop">
          <Button type="primary" icon={<ShoppingBag size={16} />}>
            Mua thêm
          </Button>
        </Link>
      </div>
      {query.isError ? (
        <QueryError error={query.error} onRetry={query.refetch} />
      ) : query.isPending ? (
        <Skeleton active />
      ) : !orders.length ? (
        <Empty description={query.data.length ? 'Không có đơn ở trạng thái này.' : 'Bạn chưa có đơn hàng nào.'} />
      ) : (
        <>
          <ul className="af-shop-orders">
            {visible.map((order) => (
              <li key={order.id}>
                <Link to={`/shop/orders/${order.id}`} className="af-shop-order-row">
                  <span className="af-shop-order-main">
                    <strong>{order.orderCode}</strong>
                    <small>{[time(order.createdAt), itemSummary(order, catalog.data)].filter(Boolean).join(' · ')}</small>
                  </span>
                  <Money value={order.total} />
                  <StatusTag status={order.status} />
                  <ChevronRight size={18} aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
          <Pagination
            className="af-shop-orders-pages"
            current={current}
            pageSize={PAGE_SIZE}
            total={orders.length}
            onChange={setPage}
            showSizeChanger={false}
            hideOnSinglePage
          />
        </>
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
    queryFn: () => customerOrderApi.detail(id),
    enabled: valid && isCustomer(user),
    retry: false,
    refetchInterval: 15000,
  })
  const catalog = useOrderProducts(valid && isCustomer(user))
  const storePhone = useShopContact()?.phone
  const { message } = App.useApp()
  const client = useQueryClient()
  const cancel = useMutation({
    mutationFn: () => customerOrderApi.cancel(id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['live'] })
      message.success('Đã hủy đơn.')
    },
    onError: (error: Error) => {
      void query.refetch()
      message.error(error.message)
    },
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
  const order = query.data
  return (
    <div className="af-shop-page af-shop-narrow">
      <div className="af-shop-track">
        <Link to="/shop/orders" className="af-text-link af-shop-order-back">
          <ArrowLeft size={16} aria-hidden /> Đơn hàng của tôi
        </Link>
        {query.isError ? (
          <QueryError error={query.error} onRetry={query.refetch} />
        ) : !order ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : (
          <>
            <Card
              className="af-shop-track-card"
              title={
                <span className="af-shop-order-title">
                  Đơn {order.orderCode} <StatusTag status={order.status} />
                </span>
              }
              extra={
                <Button
                  type="text"
                  icon={<RefreshCw size={16} />}
                  aria-label="Cập nhật trạng thái"
                  loading={query.isFetching}
                  onClick={() => void query.refetch()}
                />
              }
            >
              <OrderProgress order={order} showStatus={false} />
              <dl className="af-shop-track-info">
                <dt>Người nhận</dt>
                <dd>{[order.recipientName, order.recipientPhone].filter(Boolean).join(' · ') || '—'}</dd>
                <dt>Địa chỉ</dt>
                <dd>{order.deliveryAddress || 'Nhận tại cửa hàng'}</dd>
                <dt>Ngày đặt</dt>
                <dd>{time(order.createdAt)}</dd>
                {order.requestedDeliveryAt && (
                  <>
                    <dt>Giờ hẹn</dt>
                    <dd>{time(order.requestedDeliveryAt)}</dd>
                  </>
                )}
                {order.note && (
                  <>
                    <dt>Ghi chú</dt>
                    <dd>{order.note}</dd>
                  </>
                )}
              </dl>
              <ul className="af-shop-cart af-shop-track-lines">
                {order.items.map((line) => (
                  <li key={line.id}>
                    <div>
                      <strong>{productName(catalog.data ?? [], line.productId)}</strong>
                      <small>
                        {line.quantity} × {currency(line.unitPrice)}
                      </small>
                    </div>
                    <span>{currency(line.lineTotal)}</span>
                  </li>
                ))}
              </ul>
              <dl className="af-checkout-totals">
                <div>
                  <dt>Tiền hàng</dt>
                  <dd className="af-money">{currency(order.subtotal)}</dd>
                </div>
                {order.discountAmount > 0 && (
                  <div>
                    <dt>Giảm giá</dt>
                    <dd className="af-money">−{currency(order.discountAmount)}</dd>
                  </div>
                )}
                <div>
                  <dt>Phí giao</dt>
                  <dd>{order.deliveryFee ? <span className="af-money">{currency(order.deliveryFee)}</span> : 'Miễn phí'}</dd>
                </div>
                <div className="is-total">
                  <dt>{order.status === 'PENDING' ? 'Tạm tính' : 'Tổng cộng'}</dt>
                  <dd>
                    <Money value={order.total} tone="due" />
                  </dd>
                </div>
                {order.status !== 'CANCELLED' && (
                  <div>
                    <dt>Thanh toán</dt>
                    <dd>{paymentStatusLabels[order.paymentStatus]}</dd>
                  </div>
                )}
              </dl>
            </Card>
            {catalog.isError && (
              <Alert
                type="warning"
                title="Không tải được tên sản phẩm; đang hiển thị mã sản phẩm."
                action={<Button onClick={() => void catalog.refetch()}>Thử lại</Button>}
              />
            )}
            <div className="af-shop-track-actions">
              {/* Khách tự hủy khi cửa hàng chưa xác nhận; đã xác nhận thì phải gọi cửa hàng. */}
              {order.status === 'PENDING' && (
                <Popconfirm
                  title="Hủy đơn này?"
                  okText="Hủy đơn"
                  okButtonProps={{ danger: true }}
                  cancelText="Không"
                  onConfirm={() => cancel.mutate()}
                >
                  <Button danger loading={cancel.isPending}>
                    Hủy đơn
                  </Button>
                </Popconfirm>
              )}
              {storePhone && (
                <Button icon={<Phone size={16} />} href={`tel:${storePhone.replace(/\s/g, '')}`}>
                  Gọi cửa hàng
                </Button>
              )}
              <Link to="/shop" className="af-text-link">
                Tiếp tục mua
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
