import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Card, Empty, Pagination, Popconfirm, Result, Select, Skeleton, Tag } from 'antd'
import { ChevronRight, Phone, RefreshCw, RotateCcw, ShoppingBag } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useOutletContext, useParams } from 'react-router'
import { useAuth } from '@/features/auth/useAuth'
import { isCustomer } from '@/features/auth/accountAccess'
import { orderStatusLabels, paymentStatusLabels, type LiveOrder } from '@/features/live/orderApi'
import { catalogApi } from '@/features/live/catalogApi'
import { orderTrackingApi } from '@/features/live/orderTrackingApi'
import { OrderProgress } from '@/features/orders/OrderProgress'
import { statusColor } from '@/features/orders/orderStatus'
import type { OrderStatus as StaffOrderStatus } from '@/features/orders/types'
import { ApiError } from '@/shared/api/client'
import { Money } from '@/shared/components/Money'
import { accountKey, customerAccountApi } from './customerAccountApi'
import { TransferQr } from '@/shared/payment/TransferQr'
import { dueTone } from '@/shared/utils/money'
import { QueryError } from '@/shared/components/QueryError'
import { currency } from '@/shared/utils/format'
import { useCartActions } from './cart'
import { customerOrderApi } from './customerOrderApi'
import { shopKeys, useShopContact, useTransferAccount } from './shopService'

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
/** Backend tự ghi số tầng vào ghi chú; giao tầng trệt (0) thì không cần hiện cho khách. */
const visibleNote = (note: string | null) =>
  (note ?? '')
    .split('\n')
    .filter((line) => line.trim() !== 'Số tầng đi thang bộ: 0')
    .join('\n')
    .trim()
/** Địa chỉ giao kèm phường/xã (API trả hai trường riêng). */
const fullAddress = (order: LiveOrder) => {
  if (!order.deliveryAddress) return 'Nhận tại cửa hàng'
  return order.deliveryArea && !order.deliveryAddress.includes(order.deliveryArea)
    ? `${order.deliveryAddress}, ${order.deliveryArea}`
    : order.deliveryAddress
}
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
  useEffect(() => {
    document.title = 'Tra cứu đơn | AquaFlow'
  }, [])
  const orders = [...(query.data ?? [])]
    .filter((order) => status === 'ALL' || order.status === status)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
  // Đơn bị lọc bớt hoặc hủy làm hụt trang thì lùi về trang cuối còn dữ liệu.
  const current = Math.min(page, Math.max(1, Math.ceil(orders.length / PAGE_SIZE)))
  const visible = orders.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)
  return (
    <div className="af-shop-page af-shop-account-page">
      <h1>Tra cứu đơn</h1>
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
  const cart = useCartActions()
  const account = useTransferAccount()
  const bottles = useQuery({
    queryKey: [...accountKey(user?.email), 'bottles'],
    queryFn: customerAccountApi.bottles,
    enabled: valid && isCustomer(user),
  })
  // Chi tiết đơn trả kèm số đã trả/còn phải trả; backend cũ chưa có thì lấy qua mã theo dõi đơn như trước.
  const ownBalance = query.data && query.data.paid != null && query.data.due != null ? { paid: query.data.paid, due: query.data.due } : undefined
  const trackingToken = ownBalance ? '' : (query.data?.trackingToken ?? '')
  const tracked = useQuery({
    queryKey: [...shopKeys.track(trackingToken), 'live'],
    queryFn: () => orderTrackingApi.byToken(trackingToken),
    enabled: Boolean(trackingToken),
    retry: false,
    refetchInterval: 20_000,
  }).data
  const balance = ownBalance ?? tracked
  // Trang nằm trong ShopLayout nên có nút mở giỏ; khi dựng riêng (test) thì không có.
  const openCart = useOutletContext<{ openCart?: () => void } | null>()?.openCart
  const placed = (useLocation().state as { placed?: boolean } | null)?.placed
  const orderCode = query.data?.orderCode
  useEffect(() => {
    document.title = orderCode ? `Đơn ${orderCode} | AquaFlow` : 'Đơn hàng | AquaFlow'
  }, [orderCode])
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
  // Mua lại: bỏ các sản phẩm còn bán của đơn vào giỏ; sản phẩm đã ngừng bán thì báo cho khách.
  const reorder = () => {
    if (!order || !catalog.data) return
    const available = order.items.filter((line) => catalog.data.some((product) => product.id === line.productId))
    available.forEach((line) => cart.add(String(line.productId), line.quantity))
    const missing = order.items.length - available.length
    if (!available.length) return void message.warning('Các sản phẩm của đơn này hiện không còn bán.')
    if (missing) message.warning(`Đã thêm ${available.length} sản phẩm vào giỏ; ${missing} sản phẩm không còn bán.`)
    else message.success('Đã thêm sản phẩm của đơn vào giỏ.')
    openCart?.()
  }
  return (
    <div className="af-shop-page af-shop-narrow">
      <div className="af-shop-track">
        {query.isError ? (
          <QueryError error={query.error} onRetry={query.refetch} />
        ) : !order ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : (
          <>
            {placed && (
              <Alert
                type="success"
                showIcon
                title={`Đã gửi đơn ${order.orderCode}`}
                description="Cửa hàng sẽ gọi xác nhận trong giờ làm việc."
              />
            )}
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
                <dd>{fullAddress(order)}</dd>
                <dt>Ngày đặt</dt>
                <dd>{time(order.createdAt)}</dd>
                {order.requestedDeliveryAt && (
                  <>
                    <dt>Giờ hẹn</dt>
                    <dd>{time(order.requestedDeliveryAt)}</dd>
                  </>
                )}
                {visibleNote(order.note) && (
                  <>
                    <dt>Ghi chú</dt>
                    <dd>{visibleNote(order.note)}</dd>
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
                {order.items.some((item) => catalog.data?.find((p) => p.id === item.productId)?.bottleTypeId != null) && (
                  <div>
                    <dt>Vỏ đang giữ · cọc</dt>
                    <dd>
                      {bottles.data
                        ? `${bottles.data.bottles.reduce((sum, line) => sum + line.holding, 0)} vỏ · cọc ${currency(bottles.data.depositPaid)}`
                        : '—'}
                    </dd>
                  </div>
                )}
                <div className="is-total">
                  <dt>{order.status === 'PENDING' ? 'Tạm tính' : 'Tổng cộng'}</dt>
                  <dd>
                    <Money value={order.total} tone="due" />
                  </dd>
                </div>
                {order.status !== 'CANCELLED' &&
                  (balance ? (
                    <>
                      {balance.paid > 0 && (
                        <div>
                          <dt>Đã thanh toán</dt>
                          <dd>
                            <Money value={balance.paid} tone="paid" />
                          </dd>
                        </div>
                      )}
                      <div>
                        <dt>Còn phải trả</dt>
                        <dd>
                          <Money value={balance.due} tone={dueTone(balance.due)} />
                        </dd>
                      </div>
                    </>
                  ) : (
                    <div>
                      <dt>Thanh toán</dt>
                      <dd>{paymentStatusLabels[order.paymentStatus]}</dd>
                    </div>
                  ))}
              </dl>
            </Card>
            {/* Chuyển khoản trước chỉ mở sau khi cửa hàng xác nhận (giá đã chốt); cửa hàng đối chiếu rồi mới ghi nhận đã trả. */}
            {balance && balance.due > 0 && !['PENDING', 'CANCELLED'].includes(order.status) && (
              <Card className="af-shop-track-card" title="Chuyển khoản">
                {account ? (
                  <>
                    <TransferQr settings={account} amount={balance.due} note={order.orderCode} />
                    <p className="af-form-hint">Giữ nguyên nội dung chuyển khoản để cửa hàng đối chiếu.</p>
                  </>
                ) : (
                  <p className="af-shop-transfer-off">Chưa hỗ trợ. Vui lòng trả tiền khi nhận hàng.</p>
                )}
              </Card>
            )}
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
              <Button
                type={order.status === 'PENDING' ? 'default' : 'primary'}
                icon={<RotateCcw size={16} />}
                disabled={!catalog.data || !order.items.length}
                onClick={reorder}
              >
                Mua lại
              </Button>
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
