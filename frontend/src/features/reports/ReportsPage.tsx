import { useState } from 'react'
import { App, Button, Card, Col, DatePicker, Descriptions, Empty, Progress, Row, Segmented, Select, Statistic, Table, Tabs, Tag, Typography, type TableColumnsType } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { useSearchParams } from 'react-router'
import { ArrowDownRight, ArrowUpRight, Download } from 'lucide-react'
import { Money } from '@/shared/components/Money'
import { OrderTotals } from '@/shared/components/OrderTotals'
import { Page } from '@/shared/components/Page'
import { PanelHeading } from '@/shared/components/PanelHeading'
import { QueryError } from '@/shared/components/QueryError'
import { compactCurrency, currency, shortDate } from '@/shared/utils/format'
import { tablePagination, tableScrollHeight } from '@/shared/utils/table'
import { DriverDeliveryChart, InlineBar, RevenueChart, ShareBar, TopProductsChart } from './charts'
import { autoGranularity, granularityLabels, groupRevenue, type Granularity } from './periods'
import { previousRange, reportChannels, useReport, type CustomerReportRow, type DriverReportRow, type InventoryReportRow, type ProductReportRow, type ReportFilters, type ReportRange } from './reportService'
import './reports.css'

const FORMAT = 'YYYY-MM-DD'
const toRange = ([from, to]: [Dayjs, Dayjs]): ReportRange => ({ from: from.format(FORMAT), to: to.format(FORMAT) })

const presets: { label: string; value: [Dayjs, Dayjs] }[] = [
  { label: 'Hôm nay', value: [dayjs(), dayjs()] },
  { label: '7 ngày qua', value: [dayjs().subtract(6, 'day'), dayjs()] },
  { label: '30 ngày qua', value: [dayjs().subtract(29, 'day'), dayjs()] },
  { label: 'Tháng này', value: [dayjs().startOf('month'), dayjs()] },
  { label: 'Tháng trước', value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
]

const productColumns: TableColumnsType<ProductReportRow> = [
  { title: 'Sản phẩm', dataIndex: 'name', ellipsis: true, fixed: 'left', width: 240 },
  { title: 'Đã bán', dataIndex: 'sold', align: 'right', width: 90, sorter: (a, b) => a.sold - b.sold },
  { title: 'Trả lại', dataIndex: 'returned', align: 'right', width: 80, render: (value: number) => value || '—' },
  { title: 'Doanh thu', dataIndex: 'revenue', align: 'right', width: 130, defaultSortOrder: 'descend', sorter: (a, b) => a.revenue - b.revenue, render: currency },
  { title: 'Giá vốn (ước tính)', dataIndex: 'cost', align: 'right', width: 150, render: currency },
  {
    title: 'Lãi gộp',
    key: 'gross',
    align: 'right',
    width: 130,
    sorter: (a, b) => a.revenue - a.cost - (b.revenue - b.cost),
    render: (_, row) => <Money value={Math.abs(row.revenue - row.cost)} tone={row.revenue >= row.cost ? 'paid' : 'refund'} />,
  },
]

const dash = (value: number) => value || '—'
const inventoryColumns: TableColumnsType<InventoryReportRow> = [
  { title: 'Sản phẩm', dataIndex: 'name', ellipsis: true, fixed: 'left', width: 220 },
  { title: 'Đơn vị', dataIndex: 'unit', width: 70 },
  { title: 'Tồn đầu kỳ', dataIndex: 'opening', align: 'right', width: 100 },
  { title: 'Nhập NCC', dataIndex: 'received', align: 'right', width: 90, render: dash },
  { title: 'Khách trả nhập lại', dataIndex: 'restocked', align: 'right', width: 100, render: dash },
  { title: 'Xuất bán', dataIndex: 'issued', align: 'right', width: 90, sorter: (a, b) => a.issued - b.issued, render: dash },
  { title: 'Tồn cuối kỳ', dataIndex: 'closing', align: 'right', width: 100, render: (value: number) => <strong>{value}</strong> },
  { title: 'Hỏng khi nhận', dataIndex: 'damaged', align: 'right', width: 100, render: (value: number) => (value ? <Tag color="red">{value}</Tag> : '—') },
  { title: 'Giá trị tồn cuối', dataIndex: 'closingValue', align: 'right', width: 130, sorter: (a, b) => a.closingValue - b.closingValue, render: currency },
]

const driverColumns: TableColumnsType<DriverReportRow> = [
  { title: 'Tài xế', dataIndex: 'driver', ellipsis: true, fixed: 'left', width: 150 },
  { title: 'Thành công', dataIndex: 'delivered', align: 'right', width: 96 },
  { title: 'Thất bại', dataIndex: 'failed', align: 'right', width: 80, render: (value: number) => (value ? <Tag color="red">{value}</Tag> : 0) },
  { title: 'Trễ hẹn', dataIndex: 'late', align: 'right', width: 80, render: (value: number) => (value ? <Tag color="orange">{value}</Tag> : 0) },
  { title: 'Chuyến đã đối soát', dataIndex: 'settledTrips', align: 'right', width: 100, render: dash },
  { title: 'Tiền mặt phải nộp', dataIndex: 'cashExpected', align: 'right', width: 130, render: currency },
  { title: 'Đã nộp', dataIndex: 'cashHandedOver', align: 'right', width: 120, render: (value: number) => <Money value={value} tone="paid" /> },
  {
    title: 'Chênh lệch',
    dataIndex: 'cashShort',
    align: 'right',
    width: 130,
    sorter: (a, b) => a.cashShort - b.cashShort,
    render: (value: number) => (value > 0 ? <span className="af-money is-refund">Thiếu {currency(value)}</span> : value < 0 ? `Dư ${currency(-value)}` : 'Đủ'),
  },
  {
    title: 'Chờ đối soát',
    key: 'pending',
    align: 'right',
    width: 140,
    render: (_, row) => (row.pendingTrips ? <Tag color="orange">{row.pendingTrips} chuyến · {compactCurrency(row.pendingCash)}</Tag> : '—'),
  },
]

const customerColumns: TableColumnsType<CustomerReportRow> = [
  { title: 'Khách hàng', dataIndex: 'name', ellipsis: true, render: (name: string, row) => <span title={row.phone}>{name}</span> },
  { title: 'Đơn', dataIndex: 'orders', align: 'right', width: 60 },
  { title: 'Doanh thu', dataIndex: 'revenue', align: 'right', width: 130, render: currency },
]

const lapsedColumns: TableColumnsType<CustomerReportRow> = [
  { title: 'Khách hàng', dataIndex: 'name', ellipsis: true, render: (name: string, row) => <span title={row.phone}>{name}</span> },
  { title: 'SĐT', dataIndex: 'phone', width: 120 },
  { title: 'Lần cuối', dataIndex: 'daysSince', align: 'right', width: 110, render: (days: number) => `${days} ngày trước` },
]

/** Thay đổi so với kỳ trước. `upIsGood` false khi số tăng là xấu (vd. đơn hủy). */
function Delta({ current, previous, upIsGood = true }: { current: number; previous?: number; upIsGood?: boolean }) {
  if (previous === undefined) return null
  if (previous === 0)
    return (
      <Typography.Text type="secondary" className="af-report-delta">
        {current ? 'Kỳ trước chưa có số liệu' : 'Không đổi so với kỳ trước'}
      </Typography.Text>
    )
  const change = Math.round(((current - previous) / Math.abs(previous)) * 100)
  if (change === 0) return <Typography.Text type="secondary" className="af-report-delta">Không đổi so với kỳ trước</Typography.Text>
  const Icon = change > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <Typography.Text type={change > 0 === upIsGood ? 'success' : 'danger'} className="af-report-delta">
      <Icon size={14} aria-hidden /> {change > 0 ? 'Tăng' : 'Giảm'} {Math.abs(change)}% so với kỳ trước
    </Typography.Text>
  )
}

const LAPSED_LABEL = '30 ngày'
const reportTabs = ['overview', 'delivery', 'stock', 'customers']

const methodOptions = [
  { value: 'Giao tận nơi', label: 'Giao tận nơi' },
  { value: 'Tại quầy', label: 'Nhận tại quầy' },
]

export function ReportsPage() {
  const { message } = App.useApp()
  const [exporting, setExporting] = useState(false)
  const [dates, setDates] = useState<[Dayjs, Dayjs]>(presets[2].value)
  const [channels, setChannels] = useState<NonNullable<ReportFilters['channels']>>([])
  const [method, setMethod] = useState<ReportFilters['method']>()
  const [granularity, setGranularity] = useState<Granularity>()
  // Giữ tab trên URL để tải lại trang hoặc gửi đường dẫn vẫn mở đúng phần đang xem.
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = reportTabs.includes(searchParams.get('tab') ?? '') ? searchParams.get('tab')! : 'overview'
  const setTab = (key: string) =>
    setSearchParams(
      (params) => {
        if (key === 'overview') params.delete('tab')
        else params.set('tab', key)
        return params
      },
      { replace: true },
    )
  const range = toRange(dates)
  const filters: ReportFilters = { channels, method }
  const filtered = Boolean(channels.length || method)
  const reportQuery = useReport(range, filters)
  const previous = useReport(previousRange(range), filters).data
  const report = reportQuery.data
  const loading = reportQuery.isPending
  const unit = granularity ?? autoGranularity(range)
  const buckets = report ? groupRevenue(report.days, unit) : []
  const best = buckets.reduce<(typeof buckets)[number] | undefined>((top, bucket) => (!top || bucket.revenue > top.revenue ? bucket : top), undefined)
  const onTime = report && report.delivery.withAppointment ? Math.round(((report.delivery.withAppointment - report.delivery.late) / report.delivery.withAppointment) * 100) : null
  const margin = report && report.profit.goodsRevenue ? Math.round((report.profit.gross / report.profit.goodsRevenue) * 100) : 0

  return (
    <Page
      title="Báo cáo"
      description="Doanh thu, tiền thu, giao hàng và nhập–xuất–tồn theo kỳ, tính từ giao dịch."
      actions={
        <div className="af-report-actions">
          <DatePicker.RangePicker
            aria-label="Chọn kỳ báo cáo"
            allowClear={false}
            disabled={exporting}
            format="DD/MM/YYYY"
            value={dates}
            presets={presets}
            disabledDate={(day) => day.isAfter(dayjs(), 'day')}
            onChange={(value) => value?.[0] && value[1] && setDates([value[0], value[1]])}
            className="af-report-range"
          />
          <Select
            mode="multiple"
            allowClear
            maxTagCount="responsive"
            aria-label="Lọc theo kênh tiếp nhận"
            placeholder="Mọi kênh"
            value={channels}
            onChange={setChannels}
            options={reportChannels.map((channel) => ({ value: channel, label: channel }))}
            className="af-report-filter"
          />
          <Select
            allowClear
            aria-label="Lọc theo hình thức nhận"
            placeholder="Mọi hình thức"
            value={method}
            onChange={setMethod}
            options={methodOptions}
            className="af-report-filter"
          />
          <Button
            icon={<Download size={16} />}
            disabled={!report}
            loading={exporting}
            onClick={async () => {
              if (!report || exporting) return
              setExporting(true)
              try {
                const { downloadReportExcel } = await import('./exportReport')
                await downloadReportExcel(report, filters)
                message.success('Đã tạo tệp Excel.')
              } catch {
                message.error('Không thể tạo tệp Excel. Vui lòng thử lại.')
              } finally {
                setExporting(false)
              }
            }}
          >
            Xuất Excel
          </Button>
        </div>
      }
    >
      {filtered && (
        <p className="af-form-hint af-report-filter-hint">
          Đang lọc: {[channels.length ? `kênh ${channels.join(', ')}` : '', method ? method.toLowerCase() : ''].filter(Boolean).join(' · ')}. Bộ lọc áp dụng cho doanh thu, tiền thu,
          giao hàng, bán hàng và khách hàng; tồn kho, vỏ cọc, nhập hàng và đối soát tài xế vẫn tính cho cả cửa hàng.
        </p>
      )}
      {reportQuery.isError ? (
        <Card>
          <QueryError error={reportQuery.error} onRetry={reportQuery.refetch} />
        </Card>
      ) : (
        <>
          <Row gutter={[16, 16]} className="af-stat-row af-report-kpis">
            <Col xs={24} sm={12} xl={6}>
              <Card loading={loading}>
                <Statistic title="Doanh thu thuần" value={currency(report?.sales.net ?? 0)} />
                <Typography.Text type="secondary">
                  {report?.sales.delivered ?? 0} đơn · TB {currency(report?.sales.averageOrder ?? 0)}
                </Typography.Text>
                {report && <Delta current={report.sales.net} previous={previous?.sales.net} />}
              </Card>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <Card loading={loading}>
                <Statistic className="af-stat-paid" title="Tiền thực thu" value={currency(report?.cash.collected ?? 0)} />
                <Typography.Text type="secondary">Đã trừ hoàn {currency(report?.cash.refunds ?? 0)}</Typography.Text>
                {report && <Delta current={report.cash.collected} previous={previous?.cash.collected} />}
              </Card>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <Card loading={loading}>
                <Statistic className={(report?.profit.gross ?? 0) < 0 ? 'af-stat-refund' : 'af-stat-paid'} title="Lãi gộp ước tính" value={currency(report?.profit.gross ?? 0)} />
                <Typography.Text type="secondary">Biên {margin}% · giá vốn bình quân lô</Typography.Text>
                {report && <Delta current={report.profit.gross} previous={previous?.profit.gross} />}
              </Card>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <Card loading={loading}>
                <Statistic title="Đơn tạo trong kỳ" value={report?.sales.orders ?? 0} />
                <Typography.Text type="secondary">{report?.sales.cancelled ?? 0} đơn hủy</Typography.Text>
                {report && <Delta current={report.sales.orders} previous={previous?.sales.orders} />}
              </Card>
            </Col>
          </Row>
          <Tabs
            className="af-report-tabs"
            activeKey={tab}
            onChange={setTab}
            items={[
              {
                key: 'overview',
                label: 'Doanh thu và tiền',
                children: (
                  <>
                <Row gutter={[16, 16]}>
                  <Col xs={24} xl={8}>
                    {/* Không kéo cao bằng biểu đồ bên cạnh để thẻ không trống phía dưới. */}
                    <Card title="Doanh thu" className="af-card" loading={loading}>
                      {report && (
                        <OrderTotals
                          wide
                          rows={[
                            { label: 'Tiền hàng đơn đã giao', value: currency(report.sales.goods) },
                            { label: 'Phí giao', value: currency(report.sales.deliveryFees) },
                            { label: 'Trừ hàng khách trả', value: <Money value={report.sales.returnsValue} tone="refund" /> },
                          ]}
                          total={{ label: 'Doanh thu thuần', value: currency(report.sales.net) }}
                        />
                      )}
                      <p className="af-form-hint">Ghi nhận khi khách nhận hàng. Hàng trả trừ vào kỳ khách trả, không sửa số của kỳ đã giao.</p>
                    </Card>
                  </Col>
                  <Col xs={24} xl={16}>
                    <Card
                      title={<PanelHeading title={`Doanh thu và tiền thu theo ${granularityLabels[unit].toLowerCase()}`} extra={
                        <Segmented<Granularity>
                          size="small"
                          aria-label="Gom biểu đồ theo"
                          value={unit}
                          onChange={setGranularity}
                          options={(Object.keys(granularityLabels) as Granularity[]).map((value) => ({ value, label: granularityLabels[value] }))}
                        />
                      } />}
                      className="af-card af-fill"
                      loading={loading}
                    >
                      {buckets.some((bucket) => bucket.revenue || bucket.collected) ? (
                        <>
                          <RevenueChart data={buckets} />
                          {best && <Typography.Text type="secondary">Cao nhất {best.title.toLowerCase()}: {compactCurrency(best.revenue)}</Typography.Text>}
                        </>
                      ) : (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có doanh thu trong kỳ." />
                      )}
                    </Card>
                  </Col>
                </Row>
                <Row gutter={[16, 16]}>
                  <Col xs={24} lg={12} xl={8}>
                    <Card title="Tiền thu" className="af-card af-fill" loading={loading}>
                      {report && (
                        <>
                        <ShareBar
                          parts={[
                            { label: 'Tiền mặt', value: report.cash.cash, color: 'var(--af-money-paid)' },
                            { label: 'Chuyển khoản', value: report.cash.transfer, color: 'var(--af-money-deposit)' },
                          ]}
                        />
                        <Descriptions
                          size="small"
                          column={1}
                          items={[
                            { key: 'cash', label: 'Thu tiền mặt', children: <Money value={report.cash.cash} tone="paid" /> },
                            { key: 'transfer', label: 'Thu chuyển khoản', children: <Money value={report.cash.transfer} tone="paid" /> },
                            { key: 'refunds', label: 'Hoàn tiền cho khách', children: <Money value={report.cash.refunds} tone="refund" /> },
                            { key: 'collected', label: <strong>Thực thu</strong>, children: <strong><Money value={report.cash.collected} tone="paid" /></strong> },
                            { key: 'receipts', label: 'Chi nhập hàng', children: `${report.receipts.count} phiếu · ${currency(report.receipts.value)}` },
                          ]}
                        />
                        </>
                      )}
                    </Card>
                  </Col>
                  <Col xs={24} lg={12} xl={8}>
                    <Card title="Vỏ bình và tiền cọc" className="af-card af-fill" loading={loading}>
                      {report && (
                        <>
                          <Descriptions
                            size="small"
                            column={1}
                            items={[
                              { key: 'bottles', label: 'Vỏ giao / thu / mất', children: `${report.deposits.bottlesOut} / ${report.deposits.bottlesBack} / ${report.deposits.bottlesLost}` },
                              { key: 'deposit', label: 'Cọc thu / hoàn', children: (
                                  <>
                                    <Money value={report.deposits.collected} tone="deposit" /> / <Money value={report.deposits.refunded} tone="refund" />
                                  </>
                                ),
                              },
                            ]}
                          />
                          <Typography.Text strong className="af-report-subhead">Đến hết {shortDate(report.range.to)}</Typography.Text>
                          <Descriptions
                            size="small"
                            column={1}
                            items={[
                              { key: 'held', label: 'Khách đang giữ', children: `${report.deposits.held.bottles} vỏ · ${report.deposits.held.customers} khách` },
                              { key: 'heldDeposit', label: 'Cọc cửa hàng đang giữ', children: <Money value={report.deposits.held.deposit} tone="deposit" /> },
                              {
                                key: 'uncovered',
                                label: 'Vỏ chưa đủ cọc',
                                children: report.deposits.held.uncoveredBottles ? <Tag color="orange">{report.deposits.held.uncoveredBottles} vỏ</Tag> : 'Không có',
                              },
                              {
                                key: 'top',
                                label: 'Giữ nhiều nhất',
                                children: report.deposits.held.top.length ? report.deposits.held.top.slice(0, 3).map((row) => `${row.name} (${row.bottles})`).join(', ') : '—',
                              },
                            ]}
                          />
                        </>
                      )}
                      <p className="af-form-hint">Cọc là tiền phải trả lại khách khi thu hết vỏ, không tính vào doanh thu.</p>
                    </Card>
                  </Col>
                  <Col xs={24} xl={8}>
                    <Card title="Theo kênh tiếp nhận" className="af-card af-fill" loading={loading} styles={{ body: { padding: 0 } }}>
                      {report && (
                        <Table
                          rowKey="channel"
                          size="small"
                          className="af-data-table af-table-flush"
                          pagination={false}
                          dataSource={report.channels}
                          columns={[
                            { title: 'Kênh', dataIndex: 'channel', ellipsis: true },
                            { title: 'Đơn tạo', dataIndex: 'orders', align: 'right', width: 76 },
                            { title: 'Doanh thu thuần', dataIndex: 'revenue', align: 'right', width: 132, render: (value: number) => <InlineBar value={value} max={Math.max(...report.channels.map((row) => row.revenue))}>{compactCurrency(value)}</InlineBar> },
                          ]}
                        />
                      )}
                    </Card>
                  </Col>
                </Row>
                  </>
                ),
              },
              {
                key: 'delivery',
                label: 'Giao hàng',
                children: (
                  <>
                <Row gutter={[16, 16]}>
                  <Col xs={24}>
                    <Card title="Giao hàng và đối soát tài xế" className="af-card af-fill" loading={loading} styles={{ body: { paddingTop: 12 } }}>
                      {report && (
                        <>
                          <div className="af-report-delivery">
                            <Statistic title="Giao thành công" value={report.delivery.delivered} />
                            <Statistic title="Lần giao thất bại" value={report.delivery.failedAttempts} />
                            <div>
                              <Statistic title="Trễ hẹn" value={report.delivery.late} />
                              {report.delivery.late > 0 && <Typography.Text type="secondary">TB trễ {report.delivery.averageLateMinutes} phút</Typography.Text>}
                            </div>
                            <div>
                              <Typography.Text type="secondary">Đúng hẹn</Typography.Text>
                              <Progress percent={onTime ?? 100} size="small" status={onTime !== null && onTime < 85 ? 'exception' : 'normal'} format={(value) => (onTime === null ? '—' : `${value}%`)} />
                            </div>
                          </div>
                          {report.delivery.drivers.length > 0 && <DriverDeliveryChart rows={report.delivery.drivers} />}
                          <Table<DriverReportRow>
                            rowKey="driver"
                            size="small"
                            className="af-data-table"
                            pagination={false}
                            columns={driverColumns}
                            dataSource={report.delivery.drivers}
                            locale={{ emptyText: 'Chưa có lượt giao trong kỳ.' }}
                            scroll={{ x: 1030 }}
                          />
                          <p className="af-form-hint af-report-table-hint">
                            Đối soát tính theo ngày đối soát chuyến, chỉ gồm tiền mặt tài xế thu.
                            {report.delivery.cashShort > 0 && <> Tổng nộp thiếu trong kỳ: <Money value={report.delivery.cashShort} tone="refund" />.</>}
                            {report.delivery.pendingTrips > 0 && ` Còn ${report.delivery.pendingTrips} chuyến chờ đối soát.`}
                          </p>
                        </>
                      )}
                    </Card>
                  </Col>
                </Row>
                  </>
                ),
              },
              {
                key: 'stock',
                label: 'Sản phẩm và kho',
                children: (
                  <>
                {report?.products.some((row) => row.revenue > 0) && (
                  <Card title="Sản phẩm doanh thu cao nhất" className="af-card">
                    <TopProductsChart rows={report.products} />
                  </Card>
                )}
                <Card title="Bán hàng theo sản phẩm" className="af-card" styles={{ body: { padding: 0 } }}>
                  <Table<ProductReportRow>
                    locale={{ emptyText: 'Không bán sản phẩm nào trong kỳ.' }}
                    className="af-data-table af-table-flush"
                    rowKey="productId"
                    size="middle"
                    columns={productColumns}
                    dataSource={report?.products}
                    loading={loading}
                    pagination={tablePagination}
                    scroll={{ x: 860, y: tableScrollHeight }}
                  />
                </Card>
                <Card
                  title={<PanelHeading title="Nhập – xuất – tồn" extra={report && <Typography.Text type="secondary">Giá trị tồn: {compactCurrency(report.inventory.openingValue)} → {compactCurrency(report.inventory.closingValue)}</Typography.Text>} />}
                  className="af-card"
                  styles={{ body: { padding: 0 } }}
                >
                  <Table<InventoryReportRow>
                    locale={{ emptyText: 'Không có hàng trong kho.' }}
                    className="af-data-table af-table-flush"
                    rowKey="productId"
                    size="middle"
                    columns={inventoryColumns}
                    dataSource={report?.inventory.rows}
                    loading={loading}
                    pagination={tablePagination}
                    scroll={{ x: 1010, y: tableScrollHeight }}
                  />
                  <p className="af-form-hint af-report-table-hint">Tồn tính theo hàng thực có trong kho, gồm hàng đang giữ cho đơn chưa giao. Tồn đầu + nhập − xuất = tồn cuối.</p>
                </Card>
                  </>
                ),
              },
              {
                key: 'customers',
                label: 'Khách hàng',
                children: (
                  <>
                <Card
                  title={<PanelHeading title="Khách hàng" extra={report && <Typography.Text type="secondary">{report.customers.active} khách mua · {report.customers.new} khách mới</Typography.Text>} />}
                  className="af-card"
                  loading={loading}
                >
                  {report && (
                    <Row gutter={[16, 16]}>
                      <Col xs={24} xl={12}>
                        <Typography.Text strong className="af-report-subhead">Mua nhiều nhất trong kỳ</Typography.Text>
                        <Table<CustomerReportRow>
                          rowKey="key"
                          size="small"
                          className="af-data-table"
                          pagination={false}
                          columns={customerColumns}
                          dataSource={report.customers.top}
                          locale={{ emptyText: 'Chưa có khách mua trong kỳ.' }}
                          scroll={{ x: 360 }}
                        />
                      </Col>
                      <Col xs={24} xl={12}>
                        <Typography.Text strong className="af-report-subhead">Lâu chưa đặt lại (từ {LAPSED_LABEL})</Typography.Text>
                        <Table<CustomerReportRow>
                          rowKey="key"
                          size="small"
                          className="af-data-table"
                          pagination={false}
                          columns={lapsedColumns}
                          dataSource={report.customers.lapsed}
                          locale={{ emptyText: 'Khách quen đều có đơn gần đây.' }}
                          scroll={{ x: 360 }}
                        />
                        <p className="af-form-hint">Khách đã mua từ 2 lần trở lên, gọi lại hoặc nhắn tin để chăm sóc.</p>
                      </Col>
                    </Row>
                  )}
                </Card>
                  </>
                ),
              },
            ]}
          />
        </>
      )}
    </Page>
  )
}
