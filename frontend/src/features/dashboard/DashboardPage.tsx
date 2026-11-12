import { useState, type ReactNode } from 'react'
import { Button, Card, Col, Empty, Row, Space, Tag } from 'antd'
import { ArrowRight, PackagePlus, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { deliveryToday } from './dashboardData'
import { Page } from '@/shared/components/Page'
import { PanelHeading } from '@/shared/components/PanelHeading'
import { QueryError } from '@/shared/components/QueryError'
import { BarChart } from '@/shared/components/BarChart'
import { ViewButton } from '@/shared/components/ViewButton'
import { canOpen } from '@/features/auth/permissions'
import { useStaff } from '@/features/auth/useStaff'
import { compactCurrency, currency, shortDate } from '@/shared/utils/format'
import { ReceiveStockModal } from '@/features/inventory/components/ReceiveStockModal'
import { useStockItems } from '@/features/inventory/useInventory'
import { OrderDetails } from '@/features/orders/components/OrderDetails'
import { OrderIntakeModal } from '@/features/orders/components/OrderIntakeModal'
import { OrderNextAction } from '@/features/orders/components/OrderNextAction'
import { useOrderList } from '@/features/orders/orderData'
import { ordersLink } from '@/features/orders/useOrderFilters'
import { amountDue, createdAtOf, orderedAtOf, type Order } from '@/features/orders/types'
import { dayFromToday, localDay, useDailyRevenue } from '@/features/reports/reportService'

type LowStockRow = { id: string; name: string; unit: string; stock: number; threshold?: number }

/** Sắp hết theo trang Kho: khả dụng chạm ngưỡng tối thiểu (chưa có ngưỡng thì hết hàng). */
function useLowStock() {
  const stock = useStockItems()
  const rows = (stock.data ?? [])
    .filter((item) => (item.threshold === undefined ? item.available === 0 : item.available <= item.threshold))
    .map((item): LowStockRow => ({ id: item.id, name: item.name, unit: item.unit ?? '', stock: item.available, threshold: item.threshold }))
  return { ...stock, rows }
}

/** Đã giao mà chưa thu đủ. */
const isUnpaid = (order: Order) => ['Đã giao', 'Đã hoàn tất'].includes(order.status) && amountDue(order) > 0

const timeOfDay = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
/** Giờ hẹn: hôm nay chỉ hiện giờ, ngày khác kèm ngày. */
const appointmentLabel = (iso?: string) => {
  if (!iso) return 'Chưa hẹn'
  return localDay(iso) === dayFromToday() ? timeOfDay(iso) : `${shortDate(localDay(iso)).slice(3)} ${timeOfDay(iso)}`
}

type TaskKind = 'failed' | 'pending' | 'unpaid' | 'stock'
type Task = {
  key: string
  kind: TaskKind
  title: ReactNode
  detail: ReactNode
  amount?: ReactNode
  action: ReactNode
}
const taskTags: Record<TaskKind, { label: string; color: string }> = {
  failed: { label: 'Giao thất bại', color: 'red' },
  pending: { label: 'Chờ xác nhận', color: 'gold' },
  unpaid: { label: 'Chưa thu đủ', color: 'orange' },
  stock: { label: 'Sắp hết', color: 'default' },
}
/** Trang xử lý đầy đủ của từng loại việc, cho dòng "Còn N việc khác". */
const taskPages: Record<TaskKind, { label: string; to: string }> = {
  failed: { label: 'Giao hàng', to: '/delivery' },
  pending: { label: 'Đơn hàng', to: ordersLink({ status: 'Chờ xác nhận' }) },
  unpaid: { label: 'Đơn hàng', to: ordersLink({ group: 'done', payment: 'Còn phải thu' }) },
  stock: { label: 'Kho', to: '/inventory' },
}
const TASK_LIMIT = 8

export function DashboardPage() {
  const staff = useStaff()
  const ordersQuery = useOrderList()
  const productsQuery = useLowStock()
  // API báo cáo chỉ cho chủ cửa hàng, cùng quyền với trang Báo cáo.
  const showRevenue = staff !== null && canOpen(staff.role, '/reports')
  const revenueQuery = useDailyRevenue(showRevenue)
  const revenueToday = revenueQuery.data?.at(-1)
  const revenueYesterday = revenueQuery.data?.at(-2)
  const lastWeek = revenueQuery.data?.slice(-7) ?? []
  const [creatingOrder, setCreatingOrder] = useState(false)
  const [receiving, setReceiving] = useState<{ productId?: string } | null>(null)
  const [openedOrder, setOpenedOrder] = useState<string | null>(null)
  const [taskFilter, setTaskFilter] = useState<TaskKind | 'all'>('all')

  const orders = ordersQuery.data ?? []
  const failed = orders.filter((order) => order.status === 'Giao thất bại')
  const pending = orders.filter((order) => order.status === 'Chờ xác nhận')
  const unpaid = orders.filter(isUnpaid)
  const delivery = deliveryToday(orders)
  const lowStock = productsQuery.rows
  const todayOrders = orders.filter((order) => {
    const at = createdAtOf(order)
    return at !== undefined && localDay(at) === dayFromToday()
  }).length

  const openButton = (order: Order, label = 'Xem đơn') => (
    <Button size="small" onClick={() => setOpenedOrder(order.id)}>
      {label}
    </Button>
  )
  const orderTask = (order: Order, kind: TaskKind, detail: ReactNode, action: ReactNode): Task => ({
    key: `${kind}:${order.id}`,
    kind,
    title: (
      <>
        {order.customer} <small>{order.code ?? order.id}</small>
      </>
    ),
    detail,
    amount: currency(kind === 'unpaid' ? amountDue(order) : order.total),
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
        <Space size={6}>
          {openButton(order)}
          <OrderNextAction order={order} />
        </Space>,
      ),
    ),
    ...unpaid.map((order) =>
      orderTask(
        order,
        'unpaid',
        `Đã thu ${currency(order.total - amountDue(order))} / ${currency(order.total)}`,
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
  // Bộ lọc chỉ liệt kê loại đang có việc; loại đang chọn hết việc thì quay về "Tất cả".
  const kinds = (Object.keys(taskTags) as TaskKind[])
    .map((kind) => ({ kind, count: tasks.filter((task) => task.kind === kind).length }))
    .filter((item) => item.count > 0)
  const activeFilter = kinds.some((item) => item.kind === taskFilter) ? taskFilter : 'all'
  const shownTasks = activeFilter === 'all' ? tasks : tasks.filter((task) => task.kind === activeFilter)

  const loadingTasks = ordersQuery.isPending || productsQuery.isPending
  const ordersValue = (value: ReactNode) => (ordersQuery.isPending ? 'Đang tải…' : ordersQuery.isError ? '—' : value)

  return (
    <Page
      title="Tổng quan"
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
      {/* Số trong ngày: dòng chữ, không đóng khung từng số. */}
      <dl className="af-dash-today" aria-label="Hôm nay">
        <div>
          <dt>Đơn tạo hôm nay</dt>
          <dd>{ordersValue(todayOrders)}</dd>
        </div>
        {showRevenue && (
          <>
            <div>
              <dt>Doanh thu hôm nay</dt>
              <dd>
                {revenueQuery.isPending ? 'Đang tải…' : revenueToday ? currency(revenueToday.revenue) : '—'}
                {revenueYesterday && <small>Hôm qua {currency(revenueYesterday.revenue)}</small>}
              </dd>
            </div>
            <div>
              <dt>Thu ròng hôm nay</dt>
              <dd>{revenueQuery.isPending ? 'Đang tải…' : revenueToday ? currency(revenueToday.collected) : '—'}</dd>
            </div>
          </>
        )}
        {staff?.role === 'ADMIN' && (
          <div>
            <dt>Còn phải thu</dt>
            <dd>
              {ordersValue(currency(unpaid.reduce((sum, order) => sum + amountDue(order), 0)))}
              {!ordersQuery.isPending && !ordersQuery.isError && <small>{unpaid.length} đơn</small>}
            </dd>
          </div>
        )}
      </dl>

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
            ) : productsQuery.isError ? (
              <QueryError error={productsQuery.error} onRetry={productsQuery.refetch} />
            ) : tasks.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Đã xử lý hết việc tồn đọng." />
            ) : (
              <>
                {kinds.length > 1 && (
                  <div className="af-dash-filter" role="group" aria-label="Lọc việc cần làm">
                    {[
                      { kind: 'all' as const, label: 'Tất cả', count: tasks.length },
                      ...kinds.map((item) => ({ ...item, label: taskTags[item.kind].label })),
                    ].map((item) => (
                      <button
                        key={item.kind}
                        type="button"
                        aria-pressed={activeFilter === item.kind}
                        className={activeFilter === item.kind ? 'is-active' : undefined}
                        onClick={() => setTaskFilter(item.kind)}
                      >
                        {item.label} <strong>{item.count}</strong>
                      </button>
                    ))}
                  </div>
                )}
                <ul className="af-dash-tasks">
                  {shownTasks.slice(0, TASK_LIMIT).map((task) => (
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
              </>
            )}
            {shownTasks.length > TASK_LIMIT && (
              <p className="af-dash-more">
                Còn {shownTasks.length - TASK_LIMIT} việc khác — xem ở{' '}
                {activeFilter === 'all' ? (
                  <>
                    <Link to="/orders">Đơn hàng</Link> và <Link to="/inventory">Kho</Link>
                  </>
                ) : (
                  <Link to={taskPages[activeFilter].to}>{taskPages[activeFilter].label}</Link>
                )}
                .
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
                    Giao hôm nay <span className="af-count">{ordersQuery.isError ? '—' : delivery.remaining.length}</span>
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
            ) : (
              <>
                <p className="af-dash-progress">
                  Đã giao <strong>{delivery.delivered}</strong> · còn <strong>{delivery.remaining.length}</strong>
                  {delivery.late > 0 && (
                    <>
                      {' '}
                      · <strong className="af-text-danger">trễ {delivery.late}</strong>
                    </>
                  )}
                </p>
                {delivery.remaining.length === 0 ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không còn đơn phải giao hôm nay." />
                ) : (
                  <ul className="af-dash-shipping">
                    {delivery.remaining.slice(0, TASK_LIMIT).map((order) => (
                      <li key={order.id}>
                        <time className={delivery.isLate(order) ? 'af-text-danger' : undefined}>{appointmentLabel(order.appointment)}</time>
                        <div className="af-cell-stack">
                          <span>
                            {order.customer} <small>{order.code ?? order.id}</small>
                          </span>
                          <small>
                            {order.status} · {order.address || order.items}
                          </small>
                        </div>
                        <ViewButton subject={`đơn ${order.code ?? order.id}`} onClick={() => setOpenedOrder(order.id)} />
                      </li>
                    ))}
                  </ul>
                )}
                {delivery.remaining.length > TASK_LIMIT && (
                  <p className="af-dash-more">
                    Còn {delivery.remaining.length - TASK_LIMIT} đơn khác — xem ở <Link to="/delivery">Giao hàng</Link>.
                  </p>
                )}
              </>
            )}
          </Card>
        </Col>
      </Row>

      {showRevenue && (
        <Card
          title="Doanh thu 7 ngày"
          className="af-card af-dash-revenue"
          loading={revenueQuery.isPending}
          extra={
            <Link to="/reports" className="af-text-link">
              Xem báo cáo <ArrowRight size={14} />
            </Link>
          }
        >
          {revenueQuery.isError ? (
            <QueryError error={revenueQuery.error} onRetry={revenueQuery.refetch} />
          ) : !lastWeek.some((day) => day.revenue !== 0) ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có doanh thu 7 ngày qua." />
          ) : (
            <BarChart
              data={lastWeek.map((day) => ({ label: shortDate(day.date), value: day.revenue }))}
              formatValue={compactCurrency}
              height={180}
            />
          )}
        </Card>
      )}

      {creatingOrder && <OrderIntakeModal onClose={() => setCreatingOrder(false)} onCreated={setOpenedOrder} />}
      {openedOrder !== null && <OrderDetails id={openedOrder} onClose={() => setOpenedOrder(null)} />}
      <ReceiveStockModal open={receiving !== null} defaultProductId={receiving?.productId} onClose={() => setReceiving(null)} />
    </Page>
  )
}
