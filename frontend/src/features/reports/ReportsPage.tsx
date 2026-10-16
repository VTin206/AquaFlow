import { App, Button, Card, Col, Row, Statistic, Table, Tag, Typography, type TableColumnsType } from 'antd'
import { Download } from 'lucide-react'
import { BarChart } from '../../shared/components/BarChart'
import { Page } from '../../shared/components/Page'
import { QueryError } from '../../shared/components/QueryError'
import { useColumnSort } from '../../shared/components/sortableColumn'
import { compactCurrency, currency, shortDate } from '../../shared/utils/format'
import { tablePagination, tableScrollHeight } from '../../shared/utils/table'
import { isLowStock, type Product } from '../inventory/types'
import { useProducts } from '../inventory/useProducts'
import { useDailyRevenue } from './reportService'

type SortColumn = ReturnType<typeof useColumnSort<Product>>['column']

const stockColumns = (sortColumn: SortColumn): TableColumnsType<Product> => [
  { title: 'Sản phẩm', dataIndex: 'name', ellipsis: true },
  { title: 'Có thể bán', dataIndex: 'stock', align: 'right', width: 110, render: (stock: number, product) => `${stock} ${product.unit.toLowerCase()}` },
  {
    ...sortColumn('Giá trị (giá bán)', 'value', 'number'),
    align: 'right',
    width: 160,
    sorter: (a, b) => a.stock * a.price - b.stock * b.price,
    render: (_, product) => <span className="af-money">{currency(product.stock * product.price)}</span>,
  },
  { title: '', key: 'state', width: 100, render: (_, product) => isLowStock(product) && <Tag color="red">Sắp hết</Tag> },
]

export function ReportsPage() {
  const { message } = App.useApp()
  const revenueQuery = useDailyRevenue()
  const productsQuery = useProducts()
  const sort = useColumnSort<Product>({ key: 'value', order: 'descend' })

  const days = revenueQuery.data ?? []
  const total = days.reduce((sum, day) => sum + day.revenue, 0)
  const best = days.reduce<(typeof days)[number] | undefined>((top, day) => (!top || day.revenue > top.revenue ? day : top), undefined)

  return (
    <Page
      title="Báo cáo"
      description="Tổng hợp doanh thu và tình hình kho."
      actions={
        <Button icon={<Download size={16} />} onClick={() => message.info('Xuất báo cáo sẽ hoạt động khi kết nối backend.')}>
          Xuất báo cáo
        </Button>
      }
    >
      {revenueQuery.isError ? (
        <Card>
          <QueryError error={revenueQuery.error} onRetry={revenueQuery.refetch} />
        </Card>
      ) : (
        <>
          <Row gutter={[16, 16]} className="af-stat-row">
            <Col xs={24} md={8}>
              <Card loading={revenueQuery.isPending}>
                <Statistic title={`Doanh thu ${days.length} ngày`} value={currency(total)} />
              </Card>
            </Col>
            <Col xs={12} md={8}>
              <Card loading={revenueQuery.isPending}>
                <Statistic title="Trung bình mỗi ngày" value={currency(days.length ? Math.round(total / days.length) : 0)} />
              </Card>
            </Col>
            <Col xs={12} md={8}>
              <Card loading={revenueQuery.isPending}>
                <Statistic title={best ? `Ngày cao nhất (${shortDate(best.date)})` : 'Ngày cao nhất'} value={currency(best?.revenue ?? 0)} />
              </Card>
            </Col>
          </Row>
          <Row gutter={[16, 16]}>
            <Col xs={24} xl={14}>
              <Card
                title="Doanh thu theo ngày"
                extra={<Typography.Text type="secondary">Dữ liệu mẫu</Typography.Text>}
                className="af-card af-fill"
                loading={revenueQuery.isPending}
              >
                <BarChart data={days.map((day) => ({ label: shortDate(day.date).slice(3), value: day.revenue }))} formatValue={compactCurrency} height={240} />
              </Card>
            </Col>
            <Col xs={24} xl={10}>
              <Card title="Giá trị hàng khả dụng" className="af-card af-fill" styles={{ body: { padding: 0 } }}>
                <Table<Product>
                  className="af-data-table"
                  rowKey="id"
                  size="middle"
                  columns={stockColumns(sort.column)}
                  dataSource={productsQuery.data}
                  loading={productsQuery.isPending}
                  pagination={tablePagination}
                  scroll={{ x: 600, y: tableScrollHeight }}
                />
              </Card>
            </Col>
          </Row>
        </>
      )}
    </Page>
  )
}
