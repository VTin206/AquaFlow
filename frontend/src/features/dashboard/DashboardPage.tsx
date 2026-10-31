import { useState, type ReactNode } from 'react'
import { Button, Card, Col, Empty, Row, Statistic, Tag } from 'antd'
import { ArrowRight, PackagePlus, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { BarChart } from '@/shared/components/BarChart'
import { Page } from '@/shared/components/Page'
import { PanelHeading } from '@/shared/components/PanelHeading'
import { QueryError } from '@/shared/components/QueryError'
import { useIsDemo } from '@/shared/features'
import { compactCurrency, currency, shortDate } from '@/shared/utils/format'
import { ReceiveStockModal } from '@/features/inventory/components/ReceiveStockModal'
import { useStockItems } from '@/features/inventory/useInventory'
import { isLowStock } from '@/features/inventory/types'
import { useProducts } from '@/features/inventory/useProducts'
import { LiveOrderDetails } from '@/features/live/LiveOrderDetails'
import { LiveOrderDraftModal } from '@/features/live/LiveOrderDraftModal'
import { AdvanceStatusButton } from '@/features/orders/components/AdvanceStatusButton'
import { CreateOrderModal } from '@/features/orders/components/CreateOrderModal'
import { OrdersTable } from '@/features/orders/components/OrdersTable'
import { useOrderList } from '@/features/orders/orderData'
import { amountDue, createdAtOf, orderedAtOf, type Order } from '@/features/orders/types'
import { dayFromToday, localDay, useDailyRevenue } from '@/features/reports/reportService'

type LowStockRow = { id: string; name: string; unit: string; stock: number; threshold?: number }

/** Sắp hết theo trang Kho của tài khoản thật: khả dụng chạm ngưỡng tối thiểu (chưa có ngưỡng thì hết hàng). */
function useLowStock(demo: boolean) {
  const products = useProducts(demo)
  const stock = useStockItems(!demo)
  if (demo) {
    const rows = (products.data ?? []).filter(isLowStock).map((product): LowStockRow => ({
      id: product.id,
      name: product.name,
      unit: product.unit,
      stock: product.stock,
      threshold: product.threshold,
    }))
    return { ...products, rows }
  }
  const rows = (stock.data ?? [])
    .filter((item) => (item.threshold === undefined ? item.available === 0 : item.available <= item.threshold))
    .map((item): LowStockRow => ({ id: item.id, name: item.name, unit: item.unit ?? '', stock: item.available, threshold: item.threshold }))
  return { ...stock, rows }
}

/** Đã giao mà chưa thu đủ; tài khoản thật chưa có phiếu thu nên dựa vào trạng thái thanh toán của BE. */
const isUnpaid = (order: Order, demo: boolean) =>
  ['Đã giao', 'Đã hoàn tất'].includes(order.status) &&
  (demo ? amountDue(order) > 0 : ['Chưa thanh toán', 'Thanh toán một phần'].includes(order.paymentStatusLabel ?? ''))

const timeOfDay = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
/** Giờ hẹn: hôm nay chỉ hiện giờ, ngày khác kèm ngày. */
const appointmentLabel = (iso?: string) => {
  if (!iso) return 'Chưa hẹn'
  return localDay(iso) === dayFromToday() ? timeOfDay(iso) : `${shortDate(localDay(iso)).slice(3)} ${timeOfDay(iso)}`
}

type Task = {
  key: string
  kind: 'failed' | 'pending' | 'unpaid' | 'stock'
  title: ReactNode
  detail: ReactNode
  amount?: ReactNode
  action: ReactNode
}
const taskTags: Record<Task['kind'], { label: string; color: string }> = {
  failed: { label: 'Giao thất bại', color: 'red' },
  pending: { label: 'Chờ xác nhận', color: 'gold' },
  unpaid: { label: 'Chưa thu đủ', color: 'orange' },
  stock: { label: 'Sắp hết', color: 'default' },
}
const TASK_LIMIT = 8

export function DashboardPage() {
  const demo = useIsDemo()
  const ordersQuery = useOrderList()
  const productsQuery = useLowStock(demo)
  // Báo cáo doanh thu chỉ có trong bản dùng thử; tài khoản thật chờ API báo cáo.
  const revenueQuery = useDailyRevenue(demo)
  const [creatingOrder, setCreatingOrder] = useState(false)
  const [receiving, setReceiving] = useState<{ productId?: string } | null>(null)
  const [openedOrder, setOpenedOrder] = useState<number | null>(null)

  const orders = ordersQuery.data ?? []
  const failed = orders.filter((order) => order.status === 'Giao thất bại')
  const pending = orders.filter((order) => order.status === 'Chờ xác nhận')
  const unpaid = orders.filter((order) => isUnpaid(order, demo))
  const shipping = orders
    .filter((order) => order.status === 'Đang giao')
    .sort((a, b) => (a.appointment ?? '9').localeCompare(b.appointment ?? '9'))
  const lowStock = productsQuery.rows
  const days = revenueQuery.data ?? []
  const lastWeek = days.slice(-7)
  const today = days.at(-1)
  const yesterday = days.at(-2)
  const todayOrders = orders.filter((order) => {
    const at = createdAtOf(order)
    return at !== undefined && localDay(at) === dayFromToday()
  }).length

  const openButton = (order: Order, label = 'Xem đơn') =>
    demo ? (
      <Link to="/orders">
        <Button size="small">{label}</Button>
      </Link>
    ) : (
      <Button size="small" onClick={() => setOpenedOrder(Number(order.id))}>
        {label}
      </Button>
    )
  const orderTask = (order: Order, kind: Task['kind'], detail: ReactNode, action: ReactNode): Task => ({
    key: `${kind}:${order.id}`,
    kind,
    title: (
      <>
        {order.customer} <small>{order.code ?? order.id}</small>
      </>
    ),
    detail,
    amount: currency(kind === 'unpaid' && demo ? amountDue(order) : order.total),
    action,
  })
  // Gấp nhất lên trước: giao lỗi cần hẹn lại, đơn mới chờ khách, tiền chưa thu, rồi mới tới nhập hàng.
  const tasks: Task[] = [
    ...failed.map((order) =>
      orderTask(
        order,
        'failed',
        order.items,
        <Link to="/delivery">
          <Button size="small" type="primary">
            Xử lý
          </Button>
        </Link>,
      ),
    ),
    ...pending.map((order) =>
      orderTask(
        order,
        'pending',
        `${orderedAtOf(order).label} · ${order.items}`,
        demo ? (
          <AdvanceStatusButton order={order} />
        ) : (
          <Button size="small" type="primary" onClick={() => setOpenedOrder(Number(order.id))}>
            Xem đơn
          </Button>
        ),
      ),
    ),
    ...unpaid.map((order) =>
      orderTask(
        order,
        'unpaid',
        demo ? `Đã thu ${currency(order.total - amountDue(order))} / ${currency(order.total)}` : order.paymentStatusLabel,
        openButton(order, 'Thu tiền'),
      ),
    ),
    ...lowStock.map((product): Task => ({
      key: `stock:${product.id}`,
      kind: 'stock',
      title: product.name,
      detail: (
        <>
          Còn{' '}
          <strong className="af-text-warning">
            {product.stock} {product.unit.toLowerCase()}
          </strong>
          {product.threshold !== undefined && ` · tối thiểu ${product.threshold}`}
        </>
      ),
      action: (
        <Button size="small" icon={<PackagePlus size={15} />} onClick={() => setReceiving({ productId: product.id })}>
          Nhập thêm
        </Button>
      ),
    })),
  ]

  const loadingTasks = ordersQuery.isPending || productsQuery.isPending
  // Dòng tóm tắt: chỉ liệt kê việc đang có, mỗi mục dẫn tới trang xử lý.
  const summary = [
    { count: failed.length, label: 'giao thất bại', to: '/delivery', tone: 'danger' },
    { count: pending.length, label: 'đơn chờ xác nhận', to: '/orders', tone: 'warning' },
    { count: shipping.length, label: 'đang giao', to: '/delivery' },
    { count: unpaid.length, label: 'đơn chưa thu đủ', to: '/orders', tone: 'warning' },
    { count: lowStock.length, label: 'sản phẩm sắp hết', to: '/inventory', tone: 'warning' },
  ].filter((item) => item.count > 0)

  return (
    <Page
      title="Tổng quan"
      description={new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
      actions={
        <>
          <Button icon={<PackagePlus size={16} />} onClick={() => setReceiving({})}>
            Nhập kho
          </Button>
          <Button type="primary" icon={<Plus size={16} />} onClick={() => setCreatingOrder(true)}>
            Tạo đơn hàng
          </Button>
        </>
      }
    >
      {!loadingTasks && !ordersQuery.isError && (
        <p className="af-dash-summary">
          {summary.length === 0
            ? 'Không có việc tồn đọng.'
            : summary.map((item) => (
                <Link key={item.label} to={item.to} className={item.tone ? `is-${item.tone}` : undefined}>
                  <strong>{item.count}</strong> {item.label}
                </Link>
              ))}
        </p>
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card
            title={
              <PanelHeading
                title={
                  <span className="af-panel-title">
                    Việc cần làm <span className="af-count">{ordersQuery.isError ? '—' : tasks.length}</span>
                  </span>
                }
              />
            }
            className="af-card af-fill"
            loading={loadingTasks}
          >
            {ordersQuery.isError ? (
              <QueryError error={ordersQuery.error} onRetry={ordersQuery.refetch} />
            ) : tasks.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Đã xử lý hết việc tồn đọng." />
            ) : (
              <ul className="af-dash-tasks">
                {tasks.slice(0, TASK_LIMIT).map((task) => (
                  <li key={task.key}>
                    <Tag color={taskTags[task.kind].color} variant="filled">
                      {taskTags[task.kind].label}
                    </Tag>
                    <div className="af-cell-stack">
                      <span>{task.title}</span>
                      <small>{task.detail}</small>
                    </div>
                    <strong className="af-money">{task.amount}</strong>
                    {task.action}
                  </li>
                ))}
              </ul>
            )}
            {tasks.length > TASK_LIMIT && (
              <p className="af-dash-more">
                Còn {tasks.length - TASK_LIMIT} việc khác — xem ở <Link to="/orders">Đơn hàng</Link> và <Link to="/inventory">Kho</Link>.
              </p>
            )}
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card
            title={
              <PanelHeading
                title={
                  <span className="af-panel-title">
                    Đang giao <span className="af-count">{ordersQuery.isError ? '—' : shipping.length}</span>
                  </span>
                }
                extra={
                  <Link to="/delivery" className="af-text-link">
                    Bảng giao hàng <ArrowRight size={14} />
                  </Link>
                }
              />
            }
            className="af-card af-fill"
            loading={ordersQuery.isPending}
          >
            {ordersQuery.isError ? (
              <QueryError error={ordersQuery.error} onRetry={ordersQuery.refetch} />
            ) : shipping.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có đơn đang giao." />
            ) : (
              <ul className="af-dash-shipping">
                {shipping.slice(0, TASK_LIMIT).map((order) => (
                  <li key={order.id}>
                    <time>{appointmentLabel(order.appointment)}</time>
                    <div className="af-cell-stack">
                      <span>
                        {order.customer} <small>{order.code ?? order.id}</small>
                      </span>
                      <small>{order.address || order.items}</small>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </Col>
      </Row>

      {/* Số liệu trong ngày; doanh thu và tiền đã thu cần API báo cáo nên tài khoản thật chỉ có số đơn. */}
      <dl className="af-dash-today">
        <div>
          <dt>Đơn tạo hôm nay</dt>
          <dd>{ordersQuery.isError ? '—' : todayOrders}</dd>
        </div>
        {demo && (
          <>
            <div>
              <dt>Doanh thu hôm nay</dt>
              <dd>
                {today ? currency(today.revenue) : '—'}
                {yesterday && <small>Hôm qua {currency(yesterday.revenue)}</small>}
              </dd>
            </div>
            <div>
              <dt>Đã thu hôm nay</dt>
              <dd>{today ? currency(today.collected) : '—'}</dd>
            </div>
            <div>
              <dt>Còn phải thu</dt>
              <dd>
                {currency(unpaid.reduce((sum, order) => sum + amountDue(order), 0))}
                <small>{unpaid.length} đơn</small>
              </dd>
            </div>
          </>
        )}
      </dl>

      <Row gutter={[16, 16]}>
        {demo && (
          <Col xs={24} xl={9}>
            <Card
              title={
                <PanelHeading
                  title="Doanh thu 7 ngày"
                  extra={
                    <Link to="/reports" className="af-text-link">
                      Báo cáo <ArrowRight size={14} />
                    </Link>
                  }
                />
              }
              className="af-card af-fill"
              loading={revenueQuery.isPending}
            >
              {revenueQuery.isError ? (
                <QueryError error={revenueQuery.error} onRetry={revenueQuery.refetch} />
              ) : lastWeek.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dữ liệu doanh thu." />
              ) : (
                <>
                  <Statistic
                    title="Tổng trong kỳ"
                    value={currency(lastWeek.reduce((sum, day) => sum + day.revenue, 0))}
                    className="af-chart-total"
                  />
                  <BarChart
                    data={lastWeek.map((day) => ({ label: shortDate(day.date).slice(3), value: day.revenue }))}
                    formatValue={compactCurrency}
                    height={210}
                  />
                </>
              )}
            </Card>
          </Col>
        )}
        <Col xs={24} xl={demo ? 15 : 24}>
          <Card
            title="Đơn hàng gần đây"
            className="af-card af-fill"
            styles={{ body: { padding: 0 } }}
            extra={
              <Link to="/orders" className="af-text-link">
                Xem tất cả <ArrowRight size={14} />
              </Link>
            }
          >
            {ordersQuery.isError ? (
              <QueryError error={ordersQuery.error} onRetry={ordersQuery.refetch} />
            ) : (
              <OrdersTable orders={orders.slice(0, 5)} loading={ordersQuery.isPending} compact />
            )}
          </Card>
        </Col>
      </Row>

      {demo ? (
        <CreateOrderModal open={creatingOrder} onClose={() => setCreatingOrder(false)} />
      ) : (
        creatingOrder && (
          <LiveOrderDraftModal
            onClose={() => setCreatingOrder(false)}
            onCreated={(order) => {
              setCreatingOrder(false)
              setOpenedOrder(order.id)
            }}
          />
        )
      )}
      {openedOrder !== null && <LiveOrderDetails key={openedOrder} id={openedOrder} onClose={() => setOpenedOrder(null)} />}
      <ReceiveStockModal open={receiving !== null} defaultProductId={receiving?.productId} onClose={() => setReceiving(null)} />
    </Page>
  )
}
