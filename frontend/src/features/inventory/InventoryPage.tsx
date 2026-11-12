import { useState } from 'react'
import { Badge, Button, Card, Input, Progress, Segmented, Table, Tag, Typography, type TableColumnsType } from 'antd'
import { FilePlus2, PackagePlus, Search } from 'lucide-react'
import { BulkBar } from '@/shared/components/BulkBar'
import { CountLabel } from '@/shared/components/CountLabel'
import { Page } from '@/shared/components/Page'
import { QueryError } from '@/shared/components/QueryError'
import { Unsupported } from '@/shared/components/Unsupported'
import { usePendingReturns } from '@/features/live/returnApi'
import { useColumnSort } from '@/shared/components/sortableColumn'
import { tablePagination, tableScrollHeight } from '@/shared/utils/table'
import { LotsPanel, type LotFilter } from './components/LotsPanel'
import { InventoryAttention, type AttentionItem } from './components/InventoryAttention'
import { MovementsPanel } from './components/MovementsPanel'
import { LiveReturnsPanel } from './components/LiveReturnsPanel'
import { ReceiptsPanel } from './components/ReceiptsPanel'
import { ReceiveStockModal } from './components/ReceiveStockModal'
import { useExpiryWarningDays } from '@/features/settings/settingsService'
import { daysUntilExpiry, expiryStatus, isoToVnDate } from './expiry'
import { matchesSearch } from '@/shared/utils/search'
import { useReceiptPage, useStockItems, type ReceiptView, type StockItem } from './useInventory'

type Filter = 'all' | 'low' | 'expiring' | 'expired'
type View = 'stock' | 'lots' | 'receipts' | 'returns' | 'movements'

/** Có ngưỡng tối thiểu thì so với ngưỡng; chưa có ngưỡng (BE) thì chỉ cảnh báo khi hết hàng bán được. */
const isLow = (item: StockItem) => (item.threshold === undefined ? item.available === 0 : item.available <= item.threshold)
const expiryText = (item: StockItem) => (item.nearestExpiry ? isoToVnDate(item.nearestExpiry) : '—')

export function InventoryPage() {
  const stockQuery = useStockItems()
  // Chỉ cần số phiếu nháp: lấy trang nhỏ nhất, số đếm theo trạng thái tính trên toàn bộ phiếu.
  const receiptsQuery = useReceiptPage({ page: 0, size: 1 })
  const warningDays = useExpiryWarningDays()
  const returnsCount = usePendingReturns().data?.length ?? 0
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [view, setView] = useState<View>('stock')
  // Bấm từ khung "Cần xử lý" thì tab Lô hàng mở sẵn bộ lọc tương ứng.
  const [lotFilter, setLotFilter] = useState<LotFilter>('stock')
  const [receiving, setReceiving] = useState<{
    productId?: string
    lines?: { productId: string; received: number }[]
    receipt?: ReceiptView
  } | null>(null)
  const [checkedIds, setCheckedIds] = useState<string[]>([])

  const products = stockQuery.data ?? []
  const hasThreshold = products.some((item) => item.threshold !== undefined)
  const lowStock = products.filter(isLow)
  const expiring = products.filter((item) => item.onHand > 0 && expiryStatus(expiryText(item), warningDays) === 'expiring')
  const expired = products.filter(
    (item) => item.expiredOnHand > 0 || (item.onHand > 0 && expiryStatus(expiryText(item), warningDays) === 'expired'),
  )
  const drafts = receiptsQuery.data?.statusCounts.DRAFT ?? 0
  const lowLabel = hasThreshold ? 'Sắp hết' : 'Hết hàng'
  const visible = products
    .filter((item) =>
      filter === 'low'
        ? isLow(item)
        : filter === 'expiring'
          ? expiring.includes(item)
          : filter === 'expired'
            ? expired.includes(item)
            : true,
    )
    .filter((item) => matchesSearch(query, `${item.name} ${item.sku} ${item.brand ?? ''}`))
  // Chỉ tính các dòng còn hiện theo bộ lọc; số nhập gợi ý đủ gấp đôi ngưỡng tối thiểu, sửa được trong phiếu.
  const checked = visible.filter((item) => checkedIds.includes(item.id))
  const suggestedReceipt = (items: StockItem[]) =>
    items.map((item) => ({
      productId: item.id,
      received: item.threshold === undefined ? 1 : Math.max(item.threshold * 2 - item.available, 1),
    }))
  const receiveChecked = () => {
    setReceiving({ lines: suggestedReceipt(checked) })
    setCheckedIds([])
  }
  const showStock = (next: Filter) => {
    setView('stock')
    setFilter(next)
  }
  // Xếp theo mức gấp: hàng hết hạn còn trong kho, sắp hết hàng, hàng hoàn chờ kiểm, sắp hết hạn, phiếu nháp.
  const attention: AttentionItem[] = [
    ...(expired.length
      ? [
          {
            key: 'expired',
            tone: 'danger' as const,
            text: `${expired.length} mã hàng có lô đã hết hạn còn trong kho`,
            action: {
              label: 'Xem lô hết hạn',
              onClick: () => {
                setLotFilter('expired')
                setView('lots')
              },
            },
          },
        ]
      : []),
    ...(lowStock.length
      ? [
          {
            key: 'low',
            tone: 'warning' as const,
            text: hasThreshold ? `${lowStock.length} mã hàng sắp hết` : `${lowStock.length} mã hàng đã hết hàng bán được`,
            action: { label: 'Tạo phiếu nhập', onClick: () => setReceiving({ lines: suggestedReceipt(lowStock) }) },
          },
        ]
      : []),
    ...(returnsCount
      ? [
          {
            key: 'returns',
            tone: 'warning' as const,
            text: `${returnsCount} đơn giao thất bại chờ kiểm hàng hoàn`,
            action: { label: 'Kiểm hàng', onClick: () => setView('returns') },
          },
        ]
      : []),
    ...(expiring.length
      ? [
          {
            key: 'expiring',
            tone: 'warning' as const,
            text: `${expiring.length} mã hàng có lô hết hạn trong ${warningDays} ngày`,
            action: { label: 'Xem', onClick: () => showStock('expiring') },
          },
        ]
      : []),
    ...(drafts
      ? [
          {
            key: 'drafts',
            tone: 'info' as const,
            text: `${drafts} phiếu nhập nháp chưa nhập kho`,
            action: { label: 'Xem phiếu', onClick: () => setView('receipts') },
          },
        ]
      : []),
  ]

  const sort = useColumnSort<StockItem>()
  const columns: TableColumnsType<StockItem> = [
    {
      title: 'Sản phẩm',
      dataIndex: 'name',
      render: (_, product) => (
        <div className="af-cell-stack">
          <span className="af-cell-truncate" title={product.name}>
            {product.name}
          </span>
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
              {product.threshold !== undefined ? (
                `Tối thiểu ${product.threshold}`
              ) : (
                <>
                  Khả dụng {product.available} · <Unsupported label="tối thiểu: chưa hỗ trợ" />
                </>
              )}
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
            <small className={days < 0 ? 'af-text-danger' : days <= warningDays ? 'af-text-warning' : undefined}>
              {days < 0 ? 'Đã hết hạn' : days === 0 ? 'Hết hạn hôm nay' : `Còn ${days} ngày`}
            </small>
          </div>
        )
      },
    },
    {
      title: 'Trạng thái',
      key: 'state',
      width: 130,
      render: (_, product) =>
        expired.includes(product) ? (
          <Tag color="red">Có lô hết hạn</Tag>
        ) : expiring.includes(product) ? (
          <Tag color="gold">Sắp hết hạn</Tag>
        ) : isLow(product) ? (
          <Tag color="red">{lowLabel}</Tag>
        ) : (
          <Tag color="green">Đủ hàng</Tag>
        ),
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 145,
      render: (_, product) => (
        <Button
          size="small"
          icon={<PackagePlus size={15} />}
          type={isLow(product) ? 'primary' : 'default'}
          onClick={() => setReceiving({ productId: product.id })}
        >
          Nhập thêm
        </Button>
      ),
    },
  ]

  return (
    <Page
      title="Kho hàng"
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
          {!stockQuery.isPending && <InventoryAttention items={attention} />}

          <Card
            className="af-card af-tab-card"
            styles={{ body: { padding: 0 } }}
            activeTabKey={view}
            onTabChange={(key) => {
              setLotFilter('stock')
              setView(key as View)
            }}
            tabList={[
              { key: 'stock', label: 'Tồn kho' },
              { key: 'lots', label: 'Lô hàng' },
              { key: 'receipts', label: 'Phiếu nhập' },
              {
                key: 'returns',
                label: (
                  <Badge count={returnsCount} size="small" offset={[8, -2]}>
                    Hàng hoàn
                  </Badge>
                ),
              },
              { key: 'movements', label: 'Xuất / nhập kho' },
            ]}
          >
            {view === 'returns' ? (
              <LiveReturnsPanel />
            ) : view === 'movements' ? (
              <MovementsPanel />
            ) : view === 'lots' ? (
              <LotsPanel key={lotFilter} initialFilter={lotFilter} />
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
                <BulkBar count={checked.length} noun="sản phẩm" onClear={() => setCheckedIds([])}>
                  <Button type="primary" icon={<FilePlus2 size={16} />} onClick={receiveChecked}>
                    Tạo phiếu nhập
                  </Button>
                </BulkBar>
                <Table<StockItem>
                  key={`${filter}:${query}`}
                  className="af-data-table af-table-flush"
                  size="middle"
                  rowKey="id"
                  columns={columns}
                  dataSource={visible}
                  loading={stockQuery.isPending}
                  pagination={tablePagination}
                  locale={{
                    emptyText: products.length
                      ? 'Không có sản phẩm phù hợp.'
                      : 'Chưa có sản phẩm. Thêm sản phẩm ở trang Sản phẩm trước khi nhập kho.',
                  }}
                  scroll={{ x: 1044, y: tableScrollHeight }}
                  rowSelection={{
                    selectedRowKeys: checked.map((item) => item.id),
                    onChange: (keys) => setCheckedIds(keys.map(String)),
                    fixed: 'left',
                    columnWidth: 44,
                  }}
                />
              </>
            )}
          </Card>
        </>
      )}
      <ReceiveStockModal
        key={receiving?.receipt?.id ?? 'new'}
        open={receiving !== null}
        defaultProductId={receiving?.productId}
        defaultLines={receiving?.lines}
        receipt={receiving?.receipt}
        onClose={() => setReceiving(null)}
      />
    </Page>
  )
}
