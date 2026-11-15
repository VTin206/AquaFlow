import { useState, type ReactNode } from 'react'
import { filterOn } from '@/shared/utils/filterOn'
import { useQuery } from '@tanstack/react-query'
import { Alert, App, Button, Card, Checkbox, Col, DatePicker, Descriptions, Popover, Row, Segmented, Select, Table, Tabs, Tooltip, Typography } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { Link, useSearchParams } from 'react-router'
import { ArrowDownRight, ArrowUpRight, Columns3, Info } from 'lucide-react'
import { Page } from '@/shared/components/Page'
import { QueryError } from '@/shared/components/QueryError'
import { currency } from '@/shared/utils/format'
import { reportApi, channelLabels, type ReportQuery, type ReportSection, type ReportRow } from './reportApi'
import { DriverDeliveryChart, RevenueChart, TopProductsChart } from './charts'
import { autoGranularity, granularityLabels, groupRevenue, reportPresets, type Granularity } from './periods'
import { previousRange } from './reportService'
import type { ReportColumn } from './exportLiveReport'
import './reports.css'
import { useStaff } from '@/features/auth/useStaff'

const sections: Record<ReportSection, { title: string; key: string; columns: ReportColumn[] }> = {
  products: { title: 'Sản phẩm bán', key: 'productId', columns: [
    { key: 'sku', title: 'Mã hàng' }, { key: 'name', title: 'Sản phẩm' }, { key: 'unit', title: 'Đơn vị' }, { key: 'sold', title: 'SL đã giao' }, { key: 'returned', title: 'SL khách trả' }, { key: 'revenue', title: 'Tiền hàng sau giảm giá / trả lại', money: true },
  ] },
  inventory: { title: 'Nhập – xuất – tồn', key: 'productId', columns: [
    { key: 'name', title: 'Sản phẩm' }, { key: 'unit', title: 'Đơn vị' }, { key: 'opening', title: 'Tồn đầu' }, { key: 'received', title: 'Nhập NCC' }, { key: 'restocked', title: 'Hoàn nhập kho' }, { key: 'issued', title: 'Xuất kho' }, { key: 'adjustments', title: 'Điều chỉnh (+/−)' }, { key: 'closing', title: 'Tồn cuối' }, { key: 'latestUnitCost', title: 'Giá nhập gần nhất', money: true }, { key: 'closingValue', title: 'Giá trị tồn cuối kỳ', money: true }, { key: 'damaged', title: 'Loại khi nhận NCC' }, { key: 'discarded', title: 'Loại khi hoàn hàng' },
  ] },
  delivery: { title: 'Giao hàng', key: 'driverId', columns: [
    { key: 'driver', title: 'Tài xế' }, { key: 'ordersDispatched', title: 'Đơn đã xuất' }, { key: 'ordersSucceeded', title: 'Đơn giao thành công' }, { key: 'ordersFailed', title: 'Đơn giao thất bại' }, { key: 'successRate', title: 'Tỷ lệ thành công' }, { key: 'redeliveredOrders', title: 'Đơn giao lại' }, { key: 'delivered', title: 'Lần giao thành công' }, { key: 'failed', title: 'Lần thất bại' }, { key: 'redelivered', title: 'Lần giao lại' }, { key: 'appointed', title: 'Giao có hẹn' }, { key: 'late', title: 'Giao trễ hẹn' }, { key: 'settledTrips', title: 'Chuyến đối soát' }, { key: 'cashReported', title: 'Tiền báo nộp', money: true }, { key: 'cashConfirmed', title: 'Tiền xác nhận nhận', money: true }, { key: 'cashDifference', title: 'Chênh lệch báo − nhận', money: true },
  ] },
  customers: { title: 'Khách hàng', key: 'key', columns: [
    { key: 'name', title: 'Khách hàng' }, { key: 'orders', title: 'Đơn giao trong kỳ' }, { key: 'revenue', title: 'Doanh thu sau hàng trả', money: true }, { key: 'lastOrder', title: 'Mua gần nhất' }, { key: 'daysSinceLastOrder', title: 'Ngày chưa mua' },
  ] },
}
/** Cách tính của từng bảng, xem qua ⓘ "Cách tính" thay vì đoạn chữ dài trên bảng. */
const sectionNotes: Partial<Record<ReportSection, string>> = {
  inventory: 'Tồn đầu + nhập NCC + hoàn nhập + điều chỉnh − xuất = tồn cuối. Hàng loại bỏ không nhập vào tồn. Số dư lịch sử được tính lùi từ tồn hiện tại và sổ kho. Giá trị tồn cuối = tồn cuối × giá nhập của hàng đạt từ phiếu đã xác nhận gần nhất đến cuối kỳ. Đây là giá trị vận hành, không phải giá vốn kế toán; chưa có giá nhập thì chưa định giá.',
  delivery: 'Kết quả theo cả đơn và lần giao. Tỷ lệ thành công là số đơn có kết quả cuối trong kỳ là thành công chia cho tổng đơn có kết quả cuối là thành công hoặc thất bại; các cột “Lần” vẫn giữ số attempt để đối soát retry. Giao trễ chỉ tính lần giao thành công sau giờ hẹn.',
  customers: 'Khách chưa gắn hồ sơ được gộp vào Khách vãng lai. “Ngày chưa mua” tính từ lần giao gần nhất đến ngày cuối kỳ; dùng để nhận diện khách cần chăm sóc lại.',
}
/** Bảng nhiều cột: mặc định chỉ hiện cột chính, cột còn lại bật thêm qua nút "Cột" (file Excel vẫn đủ cột). */
const coreColumns: Partial<Record<ReportSection, string[]>> = {
  inventory: ['name', 'unit', 'opening', 'received', 'issued', 'closing', 'latestUnitCost', 'closingValue'],
  delivery: ['driver', 'ordersDispatched', 'ordersSucceeded', 'ordersFailed', 'successRate', 'redelivered', 'late', 'cashDifference'],
}

const dailyColumns: ReportColumn[] = [{ key: 'date', title: 'Ngày' }, { key: 'revenue', title: 'Doanh thu', money: true }, { key: 'collected', title: 'Thanh toán ròng', money: true }, { key: 'orders', title: 'Đơn tạo' }]
/**
 * Cột tên (sản phẩm, tài xế, khách) rộng nhất, một dòng, ghim trái khi cuộn ngang; cột số tự co vừa tiêu đề và
 * con số (bảng tự canh độ rộng), canh phải.
 */
const nameKeys = ['name', 'driver']
const columnsOf = (columns: ReportColumn[]) => columns.map(column => {
  const isName = nameKeys.includes(column.key)
  const format = (value: string | number | null) => column.money ? value == null ? 'Chưa có giá nhập' : currency(Number(value)) : value ?? '—'
  return {
    title: column.title,
    dataIndex: column.key,
    key: column.key,
    render: isName
      ? (value: string | number | null) => <span className="af-report-name" title={String(value ?? '')}>{format(value)}</span>
      : format,
    fixed: isName ? ('left' as const) : undefined,
    className: isName ? undefined : 'af-nowrap',
    align: !isName && !['sku', 'unit', 'date', 'lastOrder'].includes(column.key) ? ('right' as const) : undefined,
  }
})
/** Tên khách có hồ sơ mở được hồ sơ; khách vãng lai và khách chỉ có số điện thoại thì không. */
const customerColumns = columnsOf(sections.customers.columns).map((column) => column.key !== 'name' ? column : {
  ...column,
  render: (name: string | number | null, row: ReportRow) => (
    <span className="af-report-name" title={String(name ?? '')}>
      {row.key === 'guest' || String(row.key).startsWith('SĐT ') || !row.key
        ? name
        : <Link to={`/customers?customerId=${encodeURIComponent(String(row.key))}`}>{name}</Link>}
    </span>
  ),
})

/** Chỉ số chính: nhãn ngắn, ý nghĩa đầy đủ nằm trong ⓘ. */
const kpis = [
  { title: 'Doanh thu', hint: 'Doanh thu sau giảm giá và hàng khách trả, tính theo đơn đã giao trong kỳ.', key: 'revenue', money: true },
  { title: 'Đã thu', hint: 'Thanh toán ròng đã xác nhận trong kỳ (thu trừ hoàn).', key: 'netPayments', money: true },
  { title: 'Đơn đã giao', hint: 'Số đơn giao thành công trong kỳ.', key: 'ordersDelivered', money: false },
  { title: 'Đơn tạo', hint: 'Số đơn được tạo trong kỳ, gồm cả đơn chưa giao.', key: 'ordersCreated', money: false },
] as const

/** Mức tăng/giảm so với kỳ trước; kỳ trước chưa có số liệu thì không hiện gì. */
function Delta({ current, previous }: { current: number; previous?: number }) {
  if (previous === undefined || previous === 0) return null
  const change = Math.round(((current - previous) / Math.abs(previous)) * 100)
  if (change === 0) return <span className="af-report-delta">Không đổi so với kỳ trước</span>
  const Icon = change > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span className={`af-report-delta ${change > 0 ? 'is-up' : 'is-down'}`}>
      <Icon size={14} aria-hidden /> {change > 0 ? 'Tăng' : 'Giảm'} {Math.abs(change)}% so với kỳ trước
    </span>
  )
}

/** Một chỉ số trong hàng chỉ số chính: chữ và số, không đóng khung thẻ. */
function Kpi({ title, hint, value, note, loading }: { title: string; hint: string; value: ReactNode; note?: ReactNode; loading: boolean }) {
  return (
    <div className="af-report-kpi">
      <span className="af-report-kpi-label">
        {title}
        <Tooltip title={hint}>
          <Info size={13} aria-label={hint} className="af-report-kpi-hint" />
        </Tooltip>
      </span>
      <strong className="af-report-kpi-value">{loading ? '…' : value}</strong>
      {note}
    </div>
  )
}

const shownColumns = (columns: ReportColumn[], core?: string[], extra: string[] = []) =>
  core ? columns.filter((column) => core.includes(column.key) || extra.includes(column.key)) : columns

/** Trên bảng: ⓘ "Cách tính" bên trái, nút "Cột" bên phải (chỉ bảng có cột phụ). */
function ReportTableBar({ note, columns, core, extra, onExtraChange }: {
  note?: string
  columns: ReportColumn[]
  core?: string[]
  extra: string[]
  onExtraChange: (keys: string[]) => void
}) {
  const optional = core ? columns.filter((column) => !core.includes(column.key)) : []
  if (!note && !optional.length) return null
  return (
    <div className="af-report-table-bar">
      {note ? (
        <Tooltip title={note} placement="bottomLeft">
          <span className="af-report-howto" tabIndex={0}>
            <Info size={14} aria-hidden /> Cách tính
          </span>
        </Tooltip>
      ) : <span />}
      {optional.length > 0 && (
        <Popover trigger="click" placement="bottomRight" title="Cột thêm" content={
          <Checkbox.Group className="af-report-column-picker" value={extra} onChange={(keys) => onExtraChange(keys as string[])}
            options={optional.map((column) => ({ value: column.key, label: column.title }))} />
        }>
          <Button size="small" icon={<Columns3 size={15} />}>Cột{extra.length ? ` (+${extra.length})` : ''}</Button>
        </Popover>
      )}
    </div>
  )
}

export function LiveReportsPage() {
  const staff = useStaff()
  return staff?.role === 'ADMIN' ? <LiveReportContent /> : <Alert type="warning" showIcon title="Chỉ ADMIN được xem báo cáo." />
}

const CUSTOM_RANGE = 'Tùy chọn'
const quickRanges = ['Hôm nay', '7 ngày qua', '30 ngày qua', 'Tháng này', 'Tháng trước']

function LiveReportContent() {
  const { message } = App.useApp()
  const [granularity, setGranularity] = useState<Granularity>()
  const today = dayjs(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()))
  const [dates, setDates] = useState<[Dayjs, Dayjs]>([today.subtract(29, 'day'), today])
  const [rangeError, setRangeError] = useState<string>()
  const [customRange, setCustomRange] = useState(false)
  const [extraColumns, setExtraColumns] = useState<Partial<Record<ReportSection, string[]>>>({})
  const [channel, setChannel] = useState<ReportQuery['channel']>()
  const [method, setMethod] = useState<ReportQuery['method']>()
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)
  const [exporting, setExporting] = useState(false)
  const [search, setSearch] = useSearchParams()
  const selected = search.get('tab') ?? 'overview'
  const tab = selected in sections ? selected as ReportSection : 'overview'
  const query: ReportQuery = { from: dates[0].format('YYYY-MM-DD'), to: dates[1].format('YYYY-MM-DD'), channel, method }
  const summary = useQuery({ queryKey: ['live', 'reports', 'summary', query], queryFn: () => reportApi.summary(query) })
  const priorQuery = { ...query, ...previousRange(query) }
  const previous = useQuery({ queryKey: ['live', 'reports', 'summary', priorQuery], queryFn: () => reportApi.summary(priorQuery) })
  const details = useQuery({ queryKey: ['live', 'reports', tab, query, page, size], queryFn: () => reportApi.section(tab as ReportSection, query, page, size), enabled: tab !== 'overview' })
  const unit = granularity ?? autoGranularity(query)
  const detailRows = details.data?.content ?? []
  const num = (value: string | number | null) => Number(value ?? 0)
  const report = summary.data
  const selectedSection = tab === 'overview' ? undefined : sections[tab]
  const rows: ReportRow[] = tab === 'overview' ? report?.days ?? [] : details.data?.content ?? []
  const columns = selectedSection?.columns ?? dailyColumns
  // Chọn nhanh kỳ hay dùng; kỳ khác chọn "Tùy chọn" rồi mới hiện ô chọn khoảng ngày.
  const presets = reportPresets(today).filter(({ label }) => quickRanges.includes(label))
  const activePreset = presets.find(({ value }) => value[0].isSame(dates[0], 'day') && value[1].isSame(dates[1], 'day'))?.label
  const rangeMode = customRange || !activePreset ? CUSTOM_RANGE : activePreset
  return <Page title="Báo cáo"
    actions={<Button loading={exporting} disabled={!report || summary.isError || (tab !== 'overview' && (details.isError || details.isPending)) || !rows.length} onClick={async () => {
        if (!report) return
        setExporting(true)
        try { const { downloadLiveReport } = await import('./exportLiveReport'); await downloadLiveReport(report, query, selectedSection?.title ?? 'Doanh thu theo ngày', columns, rows, tab === 'overview' ? undefined : page) }
        catch { message.error('Không thể xuất báo cáo. Vui lòng thử lại.') }
        finally { setExporting(false) }
      }}>{tab === 'overview' ? 'Xuất Excel theo ngày' : 'Xuất Excel trang này'}</Button>}>
    <div className="af-report-filters">
      <Segmented<string> aria-label="Kỳ báo cáo" value={rangeMode} onChange={value => {
        if (value === CUSTOM_RANGE) { setCustomRange(true); return }
        const preset = presets.find(({ label }) => label === value)
        if (!preset) return
        setCustomRange(false); setRangeError(undefined); setDates([preset.value[0], preset.value[1]]); setPage(0)
      }} options={[...presets.map(({ label }) => ({ value: label, label: label.replace(' qua', '') })), CUSTOM_RANGE]} />
      {rangeMode === CUSTOM_RANGE && <DatePicker.RangePicker allowClear={false} value={dates} format="DD/MM/YYYY" presets={reportPresets(today)} disabledDate={date => date.isAfter(today, 'day')}
        onChange={value => { if (value?.[0] && value[1]) { if (value[1].diff(value[0], 'day') > 365 || value[1].isAfter(today, 'day')) { setRangeError('Chọn tối đa 366 ngày và không vượt quá hôm nay.'); return }; setRangeError(undefined); setDates([value[0], value[1]]); setPage(0) } }} />}
      <Select allowClear placeholder="Mọi kênh" value={channel} className={filterOn(Boolean(channel))} style={{ width: 140 }} options={Object.entries(channelLabels).map(([value, label]) => ({ value, label }))} onChange={value => { setChannel(value); setPage(0) }} />
      <Select allowClear placeholder="Mọi hình thức" value={method} className={filterOn(Boolean(method))} style={{ width: 150 }} options={[{ value: 'DELIVERY', label: 'Giao tận nơi' }, { value: 'COUNTER', label: 'Tại quầy' }]} onChange={value => { setMethod(value); setPage(0) }} />
    </div>
    {rangeError && <Alert type="warning" showIcon title={rangeError} />}
    <Typography.Text type="secondary" className="af-report-scope">Kênh và hình thức áp dụng cho doanh thu, thanh toán, sản phẩm, khách hàng và giao hàng. Kho, nhập hàng, sổ cọc và đối soát tài xế tính cho cả cửa hàng.</Typography.Text>
    {summary.isError ? <QueryError error={summary.error} onRetry={summary.refetch} /> : <>
      <div className="af-report-kpis">
        {kpis.map(({ title, hint, key, money }) => {
          const value = Number(report?.sales[key] ?? 0)
          return <Kpi key={key} title={title} hint={hint} loading={summary.isPending} value={money ? currency(value) : value} note={report && <Delta current={value} previous={previous.data?.sales[key]} />} />
        })}
        <Kpi title="Lãi gộp ước tính" hint="Doanh thu trừ giá vốn ước tính theo giá nhập xác nhận gần nhất đến cuối kỳ; không thay giá vốn kế toán." loading={summary.isPending}
          value={report && report.sales.unpricedCostLines === 0 ? currency(Number(report.sales.estimatedGrossProfit ?? 0)) : 'Chưa đủ giá nhập'}
          note={report && report.sales.totalCostLines > 0 && report.sales.unpricedCostLines > 0 && <span className="af-report-delta is-down">Thiếu giá nhập cho {report.sales.unpricedCostLines}/{report.sales.totalCostLines} dòng hàng</span>} />
      </div>
      {report && <Typography.Text type="secondary" className="af-report-scope">Kỳ trước: doanh thu {previous.isError ? 'không tải được' : previous.isPending ? '…' : currency(previous.data?.sales.revenue ?? 0)} · Đơn hủy trong kỳ: {report.sales.ordersCancelled}</Typography.Text>}
      {!!report?.sales.undatedDeliveredOrders && <Alert type="warning" showIcon title={`Có ${report.sales.undatedDeliveredOrders} đơn đã giao thiếu thời điểm giao, chưa thể tính vào doanh thu theo kỳ.`} />}
      <Tabs activeKey={tab} onChange={key => { setSearch(params => { params.set('tab', key); return params }, { replace: true }); setPage(0) }} items={[
        { key: 'overview', label: 'Tổng quan', children: report && <>
          <Card title="Doanh thu và thanh toán theo kỳ" extra={<Segmented<Granularity> size="small" aria-label="Gom biểu đồ theo" value={unit} onChange={setGranularity} options={(Object.keys(granularityLabels) as Granularity[]).map((value) => ({ value, label: granularityLabels[value] }))} />}><RevenueChart data={groupRevenue(report.days, unit)} /></Card>
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}><Col xs={24} lg={12}><Card title="Đối chiếu doanh thu"><Descriptions column={1} items={[
            { key: 'goods', label: 'Tiền hàng đã giao', children: currency(report.sales.goods) },
            { key: 'discounts', label: 'Giảm giá', children: currency(report.sales.discounts) },
            { key: 'fees', label: 'Phí giao', children: currency(report.sales.deliveryFees) },
            { key: 'returns', label: 'Hàng khách trả trong kỳ', children: currency(report.sales.returnsValue) },
          ]} /><Typography.Text type="secondary">Hoàn kho của đơn giao thất bại không trừ doanh thu lần nữa. Lãi gộp ở trên là ước tính theo giá nhập xác nhận gần nhất, không thay thế COGS kế toán theo cost layer.</Typography.Text></Card></Col>
          <Col xs={24} lg={12}><Card title="Thanh toán đã xác nhận"><Descriptions column={1} items={[
            { key: 'cash', label: 'Thu tiền mặt', children: currency(report.sales.cashIn) }, { key: 'bank', label: 'Thu chuyển khoản', children: currency(report.sales.transferIn) }, { key: 'refunds', label: 'Chi hoàn', children: currency(report.sales.refunds) },
          ]} /><Typography.Text type="secondary">Tính theo thời điểm xác nhận thanh toán, có thể gồm tiền cọc trong khoản thu. Tiền tài xế bàn giao không được cộng lần nữa.</Typography.Text></Card></Col></Row>
          <Card title="Theo kênh" style={{ marginTop: 16 }}><Table rowKey="channel" pagination={false} dataSource={report.channels} columns={[{ title: 'Kênh', dataIndex: 'channel', render: (v: keyof typeof channelLabels) => channelLabels[v] }, { title: 'Đơn tạo', dataIndex: 'orders' }, { title: 'Doanh thu', dataIndex: 'revenue', render: currency }]} /></Card>
          <Card title="Nhập hàng và sổ cọc toàn cửa hàng" style={{ marginTop: 16 }}><Descriptions column={2} items={[
            { key: 'receipts', label: 'Phiếu nhập xác nhận', children: report.receipts.count }, { key: 'value', label: 'Giá trị hàng đạt nhập', children: currency(report.receipts.value) },
            { key: 'deposit', label: 'Số dư cọc cuối kỳ', children: currency(report.deposits.held) }, { key: 'bottles', label: 'Vỏ còn ngoài cửa hàng', children: report.deposits.bottlesHeld },
            { key: 'collected', label: 'Thu cọc trong kỳ', children: currency(report.deposits.collected) }, { key: 'refunded', label: 'Hoàn cọc trong kỳ', children: currency(report.deposits.refunded) },
            { key: 'forfeited', label: 'Cọc cấn trừ mất/vỡ', children: currency(report.deposits.forfeited ?? 0) },
            { key: 'given', label: 'Vỏ giao kèm', children: report.deposits.bottlesGiven },
            { key: 'received', label: 'Vỏ thu lại', children: report.deposits.bottlesReceived },
            { key: 'lost', label: 'Vỏ mất / vỡ', children: report.deposits.bottlesLost },
            { key: 'uncovered', label: 'Cọc chưa đủ nghĩa vụ vỏ', children: currency(report.deposits.uncoveredDeposit) },
          ]} /><Typography.Text type="secondary">Sổ cọc/vỏ chỉ phản ánh giao dịch đã lưu; không suy từ đơn hàng.</Typography.Text></Card>
        </> },
        ...Object.entries(sections).map(([key, section]) => ({ key, label: section.title, children: details.isError ? <QueryError error={details.error} onRetry={details.refetch} /> : <Card>
          {key === 'products' && detailRows.some((row) => num(row.revenue) > 0) && <TopProductsChart rows={detailRows.map((row) => ({ name: String(row.name), unit: String(row.unit), sold: num(row.sold), revenue: num(row.revenue) }))} />}
          {key === 'delivery' && detailRows.length > 0 && <DriverDeliveryChart rows={detailRows.map((row) => ({ driver: String(row.driver), delivered: num(row.delivered), late: num(row.late), failed: num(row.failed) }))} />}
          <ReportTableBar note={sectionNotes[key as ReportSection]} columns={section.columns} core={coreColumns[key as ReportSection]} extra={extraColumns[key as ReportSection] ?? []}
            onExtraChange={(keys) => setExtraColumns((previous) => ({ ...previous, [key]: keys }))} />
          <Table<ReportRow> rowKey={section.key} loading={details.isPending} columns={key === 'customers' ? customerColumns : columnsOf(shownColumns(section.columns, coreColumns[key as ReportSection], extraColumns[key as ReportSection]))} dataSource={details.data?.content ?? []} scroll={{ x: 'max-content' }} locale={{ emptyText: details.isPending ? 'Đang tải báo cáo…' : 'Chưa có dữ liệu trong kỳ.' }}
            pagination={{ current: page + 1, pageSize: size, total: details.data?.totalElements ?? 0, showSizeChanger: true, pageSizeOptions: [20, 50, 100], onChange: (next, nextSize) => { setPage(nextSize === size ? next - 1 : 0); setSize(nextSize) } }} />
        </Card> })),
      ]} />
    </>}
  </Page>
}
