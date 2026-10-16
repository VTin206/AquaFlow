import { useState } from 'react'
import { Button, Card, Col, Empty, Row, Statistic, Tag, Typography } from 'antd'
import { ArrowRight, PackagePlus, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { BarChart } from '../../shared/components/BarChart'
import { Page } from '../../shared/components/Page'
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
  const completedRevenue = orders.filter((order) => order.status === 'Đã hoàn tất').reduce((sum, order) => sum + order.total, 0)
  const lowStock = products.filter(isLowStock)
  const lastWeek = (revenueQuery.data ?? []).slice(-7)

  return (
    <Page
      title="Tổng quan"
      description="Tình hình cửa hàng hôm nay."
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
      <Row gutter={[16, 16]} className="af-stat-row">
        <Col xs={12} lg={6}>
          <Card loading={ordersQuery.isPending}>
            <Statistic title="Doanh thu đơn đã hoàn tất" value={currency(completedRevenue)} />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Link to="/orders">
            <Card hoverable loading={ordersQuery.isPending}>
              <Statistic title="Đơn chờ xác nhận" value={pending.length} className={pending.length ? 'af-stat-warning' : undefined} />
            </Card>
          </Link>
        </Col>
        <Col xs={12} lg={6}>
          <Link to="/delivery">
            <Card hoverable loading={ordersQuery.isPending}>
              <Statistic title="Đơn đang giao" value={shipping.length} />
            </Card>
          </Link>
        </Col>
        <Col xs={12} lg={6}>
          <Link to="/inventory">
            <Card hoverable loading={productsQuery.isPending}>
              <Statistic title="Sản phẩm sắp hết" value={lowStock.length} className={lowStock.length ? 'af-stat-danger' : undefined} />
            </Card>
          </Link>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="af-stat-row">
        <Col xs={24} xl={10}>
          <Card title="Việc cần xử lý" className="af-card af-fill" loading={ordersQuery.isPending || productsQuery.isPending}>
            {pending.length === 0 && lowStock.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có việc tồn đọng." />
            ) : (
              <div className="af-task-list">
                {pending.map((order) => (
                  <div key={order.id} className="af-task">
                    <Tag color="gold">Đơn mới</Tag>
                    <div className="af-cell-stack">
                      <span>
                        {order.id} · {order.customer}
                      </span>
                      <small>
                        {order.items} · {currency(order.total)}
                      </small>
                    </div>
                    <AdvanceStatusButton order={order} />
                  </div>
                ))}
                {lowStock.map((product) => (
                  <div key={product.id} className="af-task">
                    <Tag color="red">Sắp hết</Tag>
                    <div className="af-cell-stack">
                      <span>{product.name}</span>
                      <small>
                        Còn {product.stock} {product.unit.toLowerCase()} · tối thiểu {product.threshold}
                      </small>
                    </div>
                    <Button size="small" onClick={() => setReceiving({ productId: product.id })}>
                      Nhập thêm
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} xl={14}>
          <Card
            title="Doanh thu 7 ngày gần nhất"
            extra={<Typography.Text type="secondary">Dữ liệu mẫu</Typography.Text>}
            className="af-card af-fill"
            loading={revenueQuery.isPending}
          >
            <Statistic title="Tổng 7 ngày" value={currency(lastWeek.reduce((sum, day) => sum + day.revenue, 0))} className="af-chart-total" />
            <BarChart data={lastWeek.map((day) => ({ label: shortDate(day.date), value: day.revenue }))} formatValue={compactCurrency} />
          </Card>
        </Col>
      </Row>

      <Card
        title="Đơn hàng gần đây"
        className="af-card"
        styles={{ body: { padding: 0 } }}
        extra={
          <Link to="/orders">
            Xem tất cả <ArrowRight size={14} className="af-inline-icon" />
          </Link>
        }
      >
        <OrdersTable orders={orders.slice(0, 5)} loading={ordersQuery.isPending} compact />
      </Card>

      <CreateOrderModal open={creatingOrder} onClose={() => setCreatingOrder(false)} />
      <ReceiveStockModal open={receiving !== null} defaultProductId={receiving?.productId} onClose={() => setReceiving(null)} />
    </Page>
  )
}
