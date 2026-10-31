import { useState } from 'react'
import { Alert, Badge, Button, Card, Col, ConfigProvider, Empty, Input, Progress, Row, Segmented, Statistic, Table, Tag, Typography, type TableColumnsType } from 'antd'
import { FilePlus2, PackagePlus, Search } from 'lucide-react'
import { CountLabel } from '@/shared/components/CountLabel'
import { Page } from '@/shared/components/Page'
import { QueryError } from '@/shared/components/QueryError'
import { UNSUPPORTED_HINT, Unsupported } from '@/shared/components/Unsupported'
import { useFeature } from '@/shared/features'
import { awaitingReturnInspection } from '@/features/orders/types'
import { useOrders } from '@/features/orders/useOrders'
import { useColumnSort } from '@/shared/components/sortableColumn'
import { currency } from '@/shared/utils/format'
import { tablePagination, tableScrollHeight } from '@/shared/utils/table'
import { LotsPanel } from './components/LotsPanel'
import { MovementsPanel } from './components/MovementsPanel'
import { ReturnsPanel } from './components/ReturnsPanel'
import { ReceiptsPanel } from './components/ReceiptsPanel'
import { ReceiveStockModal } from './components/ReceiveStockModal'
import { useExpiryWarningDays } from '@/features/settings/settingsService'
import { daysUntilExpiry, expiryStatus, isoToVnDate } from './expiry'
import { matchesSearch } from '@/shared/utils/search'
import { useReceiptViews, useStockItems, type ReceiptView, type StockItem } from './useInventory'

type Filter = 'all' | 'low' | 'expiring' | 'expired'
type View = 'stock' | 'lots' | 'receipts' | 'returns' | 'movements'

/** Có ngưỡng tối thiểu thì so với ngưỡng; chưa có ngưỡng (BE) thì chỉ cảnh báo khi hết hàng bán được. */
const isLow = (item: StockItem) => (item.threshold === undefined ? item.available === 0 : item.available <= item.threshold)
const expiryText = (item: StockItem) => (item.nearestExpiry ? isoToVnDate(item.nearestExpiry) : '—')

export function InventoryPage() {
  const stockQuery = useStockItems()
  const receiptsQuery = useReceiptViews()
  const warningDays = useExpiryWarningDays()
  const showReturns = useFeature('deliveryReturns')
  const returnsCount = (useOrders(showReturns).data ?? []).filter(awaitingReturnInspection).length
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [view, setView] = useState<View>('stock')
  const [receiving, setReceiving] = useState<{ productId?: string; receipt?: ReceiptView } | null>(null)

  const products = stockQuery.data ?? []
  const hasThreshold = products.some((item) => item.threshold !== undefined)
  const lowStock = products.filter(isLow)
  const expiring = products.filter((item) => item.onHand > 0 && expiryStatus(expiryText(item), warningDays) === 'expiring')
  const expired = products.filter((item) => item.expiredOnHand > 0 || (item.onHand > 0 && expiryStatus(expiryText(item), warningDays) === 'expired'))
  const drafts = (receiptsQuery.data ?? []).filter((receipt) => receipt.status === 'DRAFT').length
  const lowLabel = hasThreshold ? 'Sắp hết' : 'Hết hàng'
  const visible = products
    .filter((item) => (filter === 'low' ? isLow(item) : filter === 'expiring' ? expiring.includes(item) : filter === 'expired' ? expired.includes(item) : true))
    .filter((item) => matchesSearch(query, `${item.name} ${item.sku} ${item.brand ?? ''}`))

  const sort = useColumnSort<StockItem>()
  const columns: TableColumnsType<StockItem> = [
    {
      title: 'Sản phẩm',
      dataIndex: 'name',
      render: (_, product) => (
        <div className="af-cell-stack">
          <span className="af-cell-truncate" title={product.name}>{product.name}</span>
          <small className="af-cell-truncate" title={[product.sku, product.brand].filter(Boolean).join(' · ')}>
            {[product.sku, product.brand].filter(Boolean).join(' · ')}
          </small>
        </div>
      ),
    },
    {
      ...sort.column('Tồn kho', 'onHand', 'stockRatio'),
      dataIndex: 'onHand',
      width: 240,
      sorter: (a, b) => (a.threshold && b.threshold ? a.available / a.threshold - b.available / b.threshold : a.available - b.available),
      render: (_, product) => (
        <div className="af-stock-cell">
          <div className="af-stock-summary">
            <span className="af-money">
              {product.onHand} <Typography.Text type="secondary">{product.unit?.toLowerCase()}</Typography.Text>
            </span>
            <small>
              {product.threshold !== undefined ? `Tối thiểu ${product.threshold}` : <>Khả dụng {product.available} · <Unsupported label="tối thiểu: chưa hỗ trợ" /></>}
              {product.reserved > 0 && ` · giữ ${product.reserved}`}
            </small>
          </div>
          {/* Không có ngưỡng tối thiểu thì thanh tiến độ để trống, không tự đặt ngưỡng giả. */}
          <Progress
            percent={product.threshold === undefined ? 0 : Math.min(100, (product.available / Math.max(1, product.threshold * 2)) * 100)}
            showInfo={false}
            size="small"
            status={product.threshold !== undefined && isLow(product) ? 'exception' : 'normal'}
          />
        </div>
      ),
    },
    {
      title: 'Hạn sử dụng gần nhất',
      key: 'expiry',
      width: 190,
      render: (_, product) => {
        const expiry = expiryText(product)
        const days = daysUntilExpiry(expiry)
        if (days === null) return <Typography.Text type="secondary">{product.onHand > 0 ? 'Không áp dụng' : '—'}</Typography.Text>
        return (
          <div className="af-cell-stack">
            <span>{expiry}</span>
            <small className={days < 0 ? 'af-text-danger' : days <= warningDays ? 'af-text-warning' : undefined}>{days < 0 ? 'Đã hết hạn' : days === 0 ? 'Hết hạn hôm nay' : `Còn ${days} ngày`}</small>
          </div>
        )
      },
    },
    {
      title: 'Trạng thái',
      key: 'state',
      width: 130,
      render: (_, product) => expired.includes(product)
        ? <Tag color="red">Có lô hết hạn</Tag>
        : expiring.includes(product)
          ? <Tag color="gold">Sắp hết hạn</Tag>
          : isLow(product) ? <Tag color="red">{lowLabel}</Tag> : <Tag color="green">Đủ hàng</Tag>,
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 145,
      render: (_, product) => (
        <Button size="small" icon={<PackagePlus size={15} />} type={isLow(product) ? 'primary' : 'default'} onClick={() => setReceiving({ productId: product.id })}>
          Nhập thêm
        </Button>
      ),
    },
  ]

  return (
    <Page
      title="Kho hàng"
      description="Theo dõi tồn kho, tách lô đã hết hạn và kiểm nhận hàng từ nhà cung cấp."
      actions={
        <Button type="primary" icon={<FilePlus2 size={16} />} onClick={() => setReceiving({})}>
          Tạo phiếu nhập
        </Button>
      }
    >
      {stockQuery.isError ? (
        <Card>
          <QueryError error={stockQuery.error} onRetry={stockQuery.refetch} />
        </Card>
      ) : (
        <>
          {drafts > 0 && view !== 'receipts' && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              title={`Có ${drafts} phiếu nhập nháp chưa nhập kho.`}
              action={<Button size="small" onClick={() => setView('receipts')}>Xem phiếu</Button>}
            />
          )}
          <ConfigProvider theme={{ components: { Card: { bodyPadding: 12 }, Statistic: { titleFontSize: 12, contentFontSize: 20, lineHeight: 1.4 } } }}>
            <Row gutter={[12, 12]} className="af-stat-row af-inventory-stats">
              <Col xs={12} lg={4}>
                <Card loading={stockQuery.isPending}>
                  <Statistic title="Mã hàng đang kinh doanh" value={products.length} />
                </Card>
              </Col>
              <Col xs={12} lg={4}>
                <Card loading={stockQuery.isPending}>
                  <Statistic title={hasThreshold ? 'Tồn kho thấp' : 'Hết hàng bán được'} value={lowStock.length} className={lowStock.length ? 'af-stat-danger' : undefined} />
                </Card>
              </Col>
              <Col xs={12} lg={4}>
                <Card loading={stockQuery.isPending}>
                  <Statistic title={`Hết hạn trong ${warningDays} ngày`} value={expiring.length} className={expiring.length ? 'af-stat-warning' : undefined} />
                </Card>
              </Col>
              <Col xs={12} lg={4}>
                <Card loading={stockQuery.isPending}>
                  <Statistic title="Mã hàng có lô hết hạn" value={expired.length} className={expired.length ? 'af-stat-danger' : undefined} />
                </Card>
              </Col>
              <Col xs={24} lg={8}>
                <Card loading={stockQuery.isPending}>
                  <Statistic title="Giá trị tồn (giá bán)" value={currency(products.reduce((sum, item) => sum + item.onHand * (item.salePrice ?? 0), 0))} />
                </Card>
              </Col>
            </Row>
          </ConfigProvider>

          <Card
            className="af-card af-tab-card"
            styles={{ body: { padding: 0 } }}
            activeTabKey={view}
            onTabChange={(key) => setView(key as View)}
            tabList={[
              { key: 'stock', label: 'Tồn kho' },
              { key: 'lots', label: 'Lô hàng' },
              { key: 'receipts', label: 'Phiếu nhập' },
              { key: 'returns', label: <Badge count={returnsCount} size="small" offset={[8, -2]}>Hàng hoàn</Badge> },
              { key: 'movements', label: 'Xuất / nhập kho' },
            ]}
          >
            {(view === 'returns' || view === 'movements') && !showReturns ? (
              <Empty className="af-unsupported-empty" description={<><strong>Chưa hỗ trợ</strong><div className="af-text-muted">{UNSUPPORTED_HINT}</div></>} />
            ) : view === 'returns' ? (
              <ReturnsPanel />
            ) : view === 'movements' ? (
              <MovementsPanel />
            ) : view === 'lots' ? (
              <LotsPanel />
            ) : view === 'receipts' ? (
              <ReceiptsPanel onEdit={(receipt) => setReceiving({ receipt })} />
            ) : (
              <>
                <div className="af-toolbar">
                  <Segmented<Filter>
                    value={filter}
                    onChange={setFilter}
                    options={[
                      { value: 'all', label: <CountLabel label="Tất cả" count={products.length} /> },
                      { value: 'low', label: <CountLabel label={lowLabel} count={lowStock.length} urgent tone="warning" /> },
                      { value: 'expiring', label: <CountLabel label="Sắp hết hạn" count={expiring.length} urgent tone="warning" /> },
                      { value: 'expired', label: <CountLabel label="Đã hết hạn" count={expired.length} tone="danger" /> },
                    ]}
                  />
                  <Input
                    allowClear
                    prefix={<Search size={16} className="af-input-icon" />}
                    placeholder="Tìm tên, mã hàng, thương hiệu..."
                    aria-label="Tìm trong kho hàng"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="af-search"
                  />
                </div>
                <Table<StockItem>
                  key={`${filter}:${query}`}
                  className="af-data-table af-table-flush"
                  size="middle"
                  rowKey="id"
                  columns={columns}
                  dataSource={visible}
                  loading={stockQuery.isPending}
                  pagination={tablePagination}
                  locale={{ emptyText: products.length ? 'Không có sản phẩm phù hợp.' : 'Chưa có sản phẩm. Thêm sản phẩm ở trang Sản phẩm trước khi nhập kho.' }}
                  scroll={{ x: 1000, y: tableScrollHeight }}
                />
              </>
            )}
          </Card>
        </>
      )}
      <ReceiveStockModal key={receiving?.receipt?.id ?? 'new'} open={receiving !== null} defaultProductId={receiving?.productId} receipt={receiving?.receipt} onClose={() => setReceiving(null)} />
    </Page>
  )
}
