import { useState } from 'react'
import { Button, Card, Col, ConfigProvider, Input, Progress, Row, Segmented, Statistic, Table, Tag, Typography, type TableColumnsType } from 'antd'
import { FilePlus2, PackagePlus, Search } from 'lucide-react'
import { CountLabel } from '../../shared/components/CountLabel'
import { Page } from '../../shared/components/Page'
import { QueryError } from '../../shared/components/QueryError'
import { currency } from '../../shared/utils/format'
import { tablePagination, tableScrollHeight } from '../../shared/utils/table'
import { ReceiveStockModal } from './components/ReceiveStockModal'
import { daysUntilExpiry, EXPIRY_WARNING_DAYS } from './expiry'
import { isLowStock, type Product } from './types'
import { useProducts } from './useProducts'

type Filter = 'all' | 'low' | 'expiring'

const isExpiringSoon = (product: Product) => {
  const days = daysUntilExpiry(product.expiry)
  return days !== null && days <= EXPIRY_WARNING_DAYS
}

export function InventoryPage() {
  const productsQuery = useProducts()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [receiving, setReceiving] = useState<{ productId?: string } | null>(null)

  const products = productsQuery.data ?? []
  const lowStock = products.filter(isLowStock)
  const expiring = products.filter(isExpiringSoon)
  const keyword = query.trim().toLowerCase()
  const visible = products
    .filter((product) => (filter === 'low' ? isLowStock(product) : filter === 'expiring' ? isExpiringSoon(product) : true))
    .filter((product) => `${product.name} ${product.sku} ${product.brand}`.toLowerCase().includes(keyword))

  const columns: TableColumnsType<Product> = [
    {
      title: 'Sản phẩm',
      dataIndex: 'name',
      render: (_, product) => (
        <div className="af-cell-stack">
          <span className="af-cell-truncate" title={product.name}>{product.name}</span>
          <small className="af-cell-truncate" title={`${product.sku} · ${product.brand}`}>
            {product.sku} · {product.brand}
          </small>
        </div>
      ),
    },
    {
      title: 'Có thể bán',
      dataIndex: 'stock',
      width: 240,
      sorter: (a, b) => a.stock / a.threshold - b.stock / b.threshold,
      render: (_, product) => (
        <div className="af-stock-cell">
          <div className="af-stock-summary">
            <span className="af-money">
              {product.stock} <Typography.Text type="secondary">{product.unit.toLowerCase()}</Typography.Text>
            </span>
            <small>Tối thiểu {product.threshold}</small>
          </div>
          <Progress
            percent={Math.min(100, (product.stock / (product.threshold * 2)) * 100)}
            showInfo={false}
            size="small"
            status={isLowStock(product) ? 'exception' : 'normal'}
          />
        </div>
      ),
    },
    {
      title: 'Hạn sử dụng gần nhất',
      dataIndex: 'expiry',
      width: 190,
      render: (expiry: string) => {
        const days = daysUntilExpiry(expiry)
        if (days === null) return <Typography.Text type="secondary">Không áp dụng</Typography.Text>
        return (
          <div className="af-cell-stack">
            <span>{expiry}</span>
            <small className={days <= EXPIRY_WARNING_DAYS ? 'af-text-warning' : undefined}>{days < 0 ? 'Đã hết hạn' : `Còn ${days} ngày`}</small>
          </div>
        )
      },
    },
    {
      title: 'Trạng thái',
      key: 'state',
      width: 130,
      render: (_, product) => (isLowStock(product) ? <Tag color="red">Sắp hết</Tag> : <Tag color="green">Đủ hàng</Tag>),
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 145,
      render: (_, product) => (
        <Button size="small" icon={<PackagePlus size={15} />} type={isLowStock(product) ? 'primary' : 'default'} onClick={() => setReceiving({ productId: product.id })}>
          Nhập thêm
        </Button>
      ),
    },
  ]

  return (
    <Page
      title="Kho hàng"
      description="Theo dõi lượng hàng có thể bán sau khi trừ hàng đã giữ cho đơn, cùng hạn sử dụng."
      actions={
        <Button type="primary" icon={<FilePlus2 size={16} />} onClick={() => setReceiving({})}>
          Tạo phiếu nhập
        </Button>
      }
    >
      {productsQuery.isError ? (
        <Card>
          <QueryError error={productsQuery.error} onRetry={productsQuery.refetch} />
        </Card>
      ) : (
        <>
          <ConfigProvider theme={{ components: { Card: { bodyPadding: 12 }, Statistic: { titleFontSize: 12, contentFontSize: 20, lineHeight: 1.4 } } }}>
            <Row gutter={[12, 12]} className="af-stat-row af-inventory-stats">
              <Col xs={12} lg={6}>
                <Card loading={productsQuery.isPending}>
                  <Statistic title="Mã hàng đang kinh doanh" value={products.length} />
                </Card>
              </Col>
              <Col xs={12} lg={6}>
                <Card loading={productsQuery.isPending}>
                  <Statistic title="Tồn kho thấp" value={lowStock.length} className={lowStock.length ? 'af-stat-danger' : undefined} />
                </Card>
              </Col>
              <Col xs={12} lg={6}>
                <Card loading={productsQuery.isPending}>
                  <Statistic title={`Hết hạn trong ${EXPIRY_WARNING_DAYS} ngày`} value={expiring.length} className={expiring.length ? 'af-stat-warning' : undefined} />
                </Card>
              </Col>
              <Col xs={12} lg={6}>
                <Card loading={productsQuery.isPending}>
                  <Statistic title="Giá trị khả dụng (giá bán)" value={currency(products.reduce((sum, item) => sum + item.stock * item.price, 0))} />
                </Card>
              </Col>
            </Row>
          </ConfigProvider>

          <Card className="af-card" styles={{ body: { padding: 0 } }}>
            <div className="af-toolbar">
              <Segmented<Filter>
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'all', label: <CountLabel label="Tất cả" count={products.length} /> },
                  { value: 'low', label: <CountLabel label="Sắp hết" count={lowStock.length} urgent /> },
                  { value: 'expiring', label: <CountLabel label="Sắp hết hạn" count={expiring.length} urgent /> },
                ]}
              />
              <Input
                allowClear
                prefix={<Search size={16} className="af-input-icon" />}
                placeholder="Tìm tên, mã hàng, thương hiệu..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="af-search"
              />
            </div>
            <Table<Product>
              className="af-data-table"
              size="middle"
              rowKey="id"
              columns={columns}
              dataSource={visible}
              loading={productsQuery.isPending}
              pagination={tablePagination}
              locale={{ emptyText: 'Không có sản phẩm phù hợp.' }}
              scroll={{ x: 1000, y: tableScrollHeight }}
            />
          </Card>
        </>
      )}
      <ReceiveStockModal open={receiving !== null} defaultProductId={receiving?.productId} onClose={() => setReceiving(null)} />
    </Page>
  )
}
