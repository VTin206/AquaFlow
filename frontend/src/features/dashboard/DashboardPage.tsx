import { useState } from 'react'
import { Avatar, Button, Card, Col, ConfigProvider, Empty, Row, Statistic, Tag } from 'antd'
import { ArrowRight, Boxes, CircleCheck, Clock3, PackagePlus, Plus, ShoppingBag, Truck, Wallet } from 'lucide-react'
import { Link } from 'react-router'
import { BarChart } from '../../shared/components/BarChart'
import { Page } from '../../shared/components/Page'
import { PanelHeading } from '../../shared/components/PanelHeading'
import { QueryError } from '../../shared/components/QueryError'
import { compactCurrency, currency, shortDate } from '../../shared/utils/format'
import { ReceiveStockModal } from '../inventory/components/ReceiveStockModal'
import { isLowStock } from '../inventory/types'
import { useProducts } from '../inventory/useProducts'
import { AdvanceStatusButton } from '../orders/components/AdvanceStatusButton'
import { CreateOrderModal } from '../orders/components/CreateOrderModal'
import { OrdersTable } from '../orders/components/OrdersTable'
import { useOrders } from '../orders/useOrders'
import { useDailyRevenue } from '../reports/reportService'

export function DashboardPage() {
  const ordersQuery = useOrders()
  const productsQuery = useProducts()
  const revenueQuery = useDailyRevenue()
  const [creatingOrder, setCreatingOrder] = useState(false)
  const [receiving, setReceiving] = useState<{ productId?: string } | null>(null)

  const orders = ordersQuery.data ?? []
  const products = productsQuery.data ?? []
  const pending = orders.filter((order) => order.status === 'Chờ xác nhận')
  const shipping = orders.filter((order) => order.status === 'Đang giao')
  const completed = orders.filter((order) => order.status === 'Đã hoàn tất')
  const completedRevenue = completed.reduce((sum, order) => sum + order.total, 0)
  const lowStock = products.filter(isLowStock)
  const lastWeek = (revenueQuery.data ?? []).slice(-7)

  return (
    <Page
      title="Tổng quan cửa hàng"
      description="Theo dõi kinh doanh, chủ động mọi đơn hàng."
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
      <ConfigProvider theme={{ components: { Card: { bodyPadding: 14 }, Statistic: { contentFontSize: 'clamp(18px, 1.6vw, 22px)', lineHeight: 1.3 } } }}>
        <Row gutter={[12, 12]} className="af-stat-row af-dashboard-stats">
          <Col xs={24} sm={12} xl={6}>
            <Card loading={ordersQuery.isPending} className="af-metric af-metric-revenue">
              <div className="af-metric-top">
                <span>Doanh thu đã hoàn tất</span>
                <span className="af-metric-icon">
                  <Wallet size={19} />
                </span>
              </div>
              <Statistic value={ordersQuery.isError ? '—' : currency(completedRevenue)} />
              <div className="af-metric-caption">
                <CircleCheck size={14} />
                {ordersQuery.isError ? 'Chưa tải được dữ liệu' : `Từ ${completed.length} đơn đã hoàn tất`}
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Link to="/orders" className="af-metric-link">
              <Card hoverable loading={ordersQuery.isPending} className="af-metric">
                <div className="af-metric-top">
                  <span>Đơn chờ xác nhận</span>
                  <span className={`af-metric-icon ${pending.length ? 'is-warning' : ''}`}>
                    <ShoppingBag size={19} />
                  </span>
                </div>
                <Statistic value={ordersQuery.isError ? '—' : pending.length} />
                <div className="af-metric-caption">
                  <span>{ordersQuery.isError ? 'Chưa tải được dữ liệu' : pending.length ? 'Cần bạn xử lý' : 'Đã xử lý hết đơn mới'}</span>
                  <ArrowRight size={15} />
                </div>
              </Card>
            </Link>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Link to="/delivery" className="af-metric-link">
              <Card hoverable loading={ordersQuery.isPending} className="af-metric">
                <div className="af-metric-top">
                  <span>Đơn đang giao</span>
                  <span className="af-metric-icon">
                    <Truck size={19} />
                  </span>
                </div>
                <Statistic value={ordersQuery.isError ? '—' : shipping.length} />
                <div className="af-metric-caption">
                  <span>Theo dõi tiến độ giao hàng</span>
                  <ArrowRight size={15} />
                </div>
              </Card>
            </Link>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Link to="/inventory" className="af-metric-link">
              <Card hoverable loading={productsQuery.isPending} className="af-metric">
                <div className="af-metric-top">
                  <span>Sản phẩm sắp hết</span>
                  <span className={`af-metric-icon ${lowStock.length ? 'is-danger' : ''}`}>
                    <Boxes size={19} />
                  </span>
                </div>
                <Statistic value={productsQuery.isError ? '—' : lowStock.length} />
                <div className="af-metric-caption">
                  <span>{productsQuery.isError ? 'Chưa tải được dữ liệu' : lowStock.length ? 'Cần bổ sung tồn kho' : 'Tồn kho trong mức an toàn'}</span>
                  <ArrowRight size={15} />
                </div>
              </Card>
            </Link>
          </Col>
        </Row>
      </ConfigProvider>

      <div className="af-section-heading">
        <h2>Ưu tiên xử lý</h2>
        <span>Những việc cần bạn chú ý</span>
      </div>
      <Row gutter={[20, 20]} className="af-stat-row">
        <Col xs={24} xl={15}>
          <Card
            title={
              <PanelHeading
                title={<span className="af-panel-title">Đơn chờ xác nhận <span className="af-count">{ordersQuery.isError ? '—' : pending.length}</span></span>}
                extra={<Link to="/orders" className="af-text-link">Xem đơn hàng <ArrowRight size={14} /></Link>}
              />
            }
            className="af-card af-fill"
            loading={ordersQuery.isPending}
          >
            {ordersQuery.isError ? (
              <QueryError error={ordersQuery.error} onRetry={ordersQuery.refetch} />
            ) : pending.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Đã xử lý hết đơn chờ xác nhận." />
            ) : (
              <div className="af-task-list">
                {pending.slice(0, 4).map((order) => (
                  <div key={order.id} className="af-pending-order">
                    <Avatar className="af-avatar" size={40}>
                      {order.customer.trim().split(/\s+/).slice(-1)[0].charAt(0)}
                    </Avatar>
                    <div className="af-cell-stack">
                      <span>{order.customer}</span>
                      <small>
                        {order.id} · {order.items}
                      </small>
                    </div>
                    <div className="af-pending-total">
                      <strong className="af-money">{currency(order.total)}</strong>
                      <small>
                        <Clock3 size={12} /> {order.time}
                      </small>
                    </div>
                    <AdvanceStatusButton order={order} />
                  </div>
                ))}
                {pending.length > 4 && (
                  <Link className="af-list-more" to="/orders">
                    Xem thêm {pending.length - 4} đơn chờ xác nhận <ArrowRight size={14} />
                  </Link>
                )}
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} xl={9}>
          <Card
            title={
              <PanelHeading
                title={<span className="af-panel-title">Cần nhập thêm <span className="af-count">{productsQuery.isError ? '—' : lowStock.length}</span></span>}
                extra={<Link to="/inventory" className="af-text-link">Xem kho <ArrowRight size={14} /></Link>}
              />
            }
            className="af-card af-fill"
            loading={productsQuery.isPending}
          >
            {productsQuery.isError ? (
              <QueryError error={productsQuery.error} onRetry={productsQuery.refetch} />
            ) : lowStock.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Tồn kho trong mức an toàn." />
            ) : (
              <div className="af-task-list">
                {lowStock.slice(0, 3).map((product) => (
                  <div key={product.id} className="af-stock-task">
                    <span className="af-stock-icon">
                      <Boxes size={19} />
                    </span>
                    <div className="af-cell-stack">
                      <span>{product.name}</span>
                      <small>
                        Còn{' '}
                        <strong className="af-text-warning">
                          {product.stock} {product.unit.toLowerCase()}
                        </strong>{' '}
                        · tối thiểu {product.threshold}
                      </small>
                    </div>
                    <Button size="small" icon={<PackagePlus size={15} />} onClick={() => setReceiving({ productId: product.id })}>
                      Nhập thêm
                    </Button>
                  </div>
                ))}
                {lowStock.length > 3 && (
                  <Link className="af-list-more" to="/inventory">
                    Xem thêm {lowStock.length - 3} sản phẩm <ArrowRight size={14} />
                  </Link>
                )}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <div className="af-section-heading">
        <h2>Hoạt động kinh doanh</h2>
        <Link to="/reports" className="af-text-link">
          Xem báo cáo <ArrowRight size={14} />
        </Link>
      </div>
      <Row gutter={[20, 20]}>
        <Col xs={24} xl={9}>
          <Card title={<PanelHeading title="Doanh thu 7 ngày" extra={<Tag variant="filled">Dữ liệu mẫu</Tag>} />} className="af-card af-fill" loading={revenueQuery.isPending}>
            {revenueQuery.isError ? (
              <QueryError error={revenueQuery.error} onRetry={revenueQuery.refetch} />
            ) : lastWeek.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dữ liệu doanh thu." />
            ) : (
              <>
                <Statistic title="Tổng doanh thu trong kỳ" value={currency(lastWeek.reduce((sum, day) => sum + day.revenue, 0))} className="af-chart-total" />
                <BarChart
                  data={lastWeek.map((day) => ({ label: shortDate(day.date).slice(3), value: day.revenue }))}
                  formatValue={compactCurrency}
                  height={210}
                />
              </>
            )}
          </Card>
        </Col>
        <Col xs={24} xl={15}>
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

      <CreateOrderModal open={creatingOrder} onClose={() => setCreatingOrder(false)} />
      <ReceiveStockModal open={receiving !== null} defaultProductId={receiving?.productId} onClose={() => setReceiving(null)} />
    </Page>
  )
}
