import { useState, type ReactNode } from 'react'
import { filterOn } from '@/shared/utils/filterOn'
import { useQuery } from '@tanstack/react-query'
import { Alert, App, Button, Card, Checkbox, ConfigProvider, DatePicker, Popover, Segmented, Select, Table, Tabs, Typography } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { Link, useSearchParams } from 'react-router'
import { ArrowDownRight, ArrowUpRight, Columns3, FileSpreadsheet, FunnelX } from 'lucide-react'
import { Page } from '@/shared/components/Page'
import { QueryError } from '@/shared/components/QueryError'
import { currency } from '@/shared/utils/format'
import { reportApi, channelLabels, type LiveReport, type ReportQuery, type ReportSection, type ReportRow } from './reportApi'
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
/** Bảng nhiều cột: mặc định chỉ hiện cột chính, cột còn lại bật thêm qua nút "Cột" (file Excel vẫn đủ cột). */
const coreColumns: Partial<Record<ReportSection, string[]>> = {
  inventory: ['name', 'unit', 'opening', 'received', 'issued', 'closing', 'latestUnitCost', 'closingValue'],
  delivery: ['driver', 'ordersDispatched', 'ordersSucceeded', 'ordersFailed', 'successRate', 'redelivered', 'late'],
}

const dailyColumns: ReportColumn[] = [{ key: 'date', title: 'Ngày' }, { key: 'revenue', title: 'Doanh thu', money: true }, { key: 'collected', title: 'Thanh toán ròng', money: true }, { key: 'orders', title: 'Đơn tạo' }]
/** Tiêu đề ngắn trên màn hình cho cột có tên dài; file Excel vẫn dùng tên đầy đủ. */
const shortTitles: Record<string, string> = {
  latestUnitCost: 'Giá nhập',
  ordersDispatched: 'Đơn xuất',
  ordersSucceeded: 'Thành công',
  ordersFailed: 'Thất bại',
  successRate: 'Tỷ lệ',
  cashDifference: 'Chênh lệch',
  revenue: 'Doanh thu',
}
/**
 * Cột tên (sản phẩm, tài xế, khách) rộng nhất, một dòng, ghim trái khi cuộn ngang; cột số vừa tiêu đề một dòng,
 * canh phải. Bảng cuộn trong khung nên cần độ rộng cố định cho từng cột.
 */
const nameKeys = ['name', 'driver']
const NAME_WIDTH = 240
const titleOf = (column: ReportColumn) => shortTitles[column.key] ?? column.title
const widthOf = (column: ReportColumn) =>
  nameKeys.includes(column.key) ? NAME_WIDTH : Math.max(column.money ? 130 : column.key === 'sku' ? 130 : 90, Math.ceil(titleOf(column).length * 8.5) + 36)
const columnsOf = (columns: ReportColumn[]) => columns.map(column => {
  const isName = nameKeys.includes(column.key)
  const format = (value: string | number | null) => column.money ? value == null ? 'Chưa có giá nhập' : currency(Number(value)) : value ?? '—'
  return {
    title: titleOf(column) === column.title ? column.title : <span title={column.title}>{titleOf(column)}</span>,
    dataIndex: column.key,
    key: column.key,
    // Cột tên không đặt độ rộng: nhận hết phần còn lại của bảng (tối thiểu NAME_WIDTH qua scroll.x).
    width: isName ? undefined : widthOf(column),
    ellipsis: isName ? { showTitle: true } : undefined,
    render: format,
    fixed: isName ? ('left' as const) : undefined,
    className: isName ? undefined : 'af-nowrap',
    align: !isName && !['sku', 'unit', 'date', 'lastOrder'].includes(column.key) ? ('right' as const) : undefined,
  }
})
const tableWidthOf = (columns: ReportColumn[]) => columns.reduce((sum, column) => sum + widthOf(column), 0)
/** Tên khách có hồ sơ mở được hồ sơ; khách vãng lai và khách chỉ có số điện thoại thì không. */
const customerColumns = columnsOf(sections.customers.columns).map((column) => column.key !== 'name' ? column : {
  ...column,
  render: (name: string | number | null, row: ReportRow) => row.key === 'guest' || String(row.key).startsWith('SĐT ') || !row.key
    ? name
    : <Link to={`/customers?customerId=${encodeURIComponent(String(row.key))}`}>{name}</Link>,
})

/** Chỉ số chính, nhãn ngắn. */
const kpis = [
  { title: 'Doanh thu', key: 'revenue', money: true },
  { title: 'Đã thu', key: 'netPayments', money: true },
  { title: 'Đơn đã giao', key: 'ordersDelivered', money: false },
  { title: 'Đơn tạo', key: 'ordersCreated', money: false },
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
function Kpi({ title, value, note, loading }: { title: string; value: ReactNode; note?: ReactNode; loading: boolean }) {
  return (
    <div className="af-report-kpi">
      <span className="af-report-kpi-label">{title}</span>
      <strong className="af-report-kpi-value">{loading ? '…' : value}</strong>
      {note}
    </div>
  )
}

type ReportLine = { label: string; value: number | null | undefined; money?: boolean; total?: boolean }

/** Danh sách nhãn – số có đường kẻ: dòng tổng in đậm, số 0 làm mờ. */
function ReportList({ title, lines, columns = false }: { title: string; lines: ReportLine[]; columns?: boolean }) {
  return (
    <section className="af-report-list">
      <h3>{title}</h3>
      <dl className={columns ? 'af-report-lines is-columns' : 'af-report-lines'}>
        {lines.map(({ label, value, money, total }) => {
          const number = Number(value ?? 0)
          const className = [total ? 'is-total' : '', number ? '' : 'is-zero'].filter(Boolean).join(' ')
          return (
            <div key={label} className={className || undefined}>
              <dt>{label}</dt>
              <dd>{money ? currency(number) : number}</dd>
            </div>
          )
        })}
      </dl>
    </section>
  )
}

/** Doanh thu theo kênh kèm thanh tỉ lệ để thấy ngay kênh nào bán nhiều. */
function ChannelList({ channels }: { channels: LiveReport['channels'] }) {
  const top = Math.max(1, ...channels.map((item) => item.revenue))
  const sorted = [...channels].sort((a, b) => b.revenue - a.revenue)
  return (
    <section className="af-report-list">
      <h3>Theo kênh</h3>
      <dl className="af-report-lines">
        {sorted.map(({ channel, orders, revenue }) => (
          <div key={channel} className={revenue ? 'af-report-channel' : 'af-report-channel is-zero'}>
            <dt>
              {channelLabels[channel] ?? channel} <small>{orders} đơn</small>
            </dt>
            <dd>{currency(revenue)}</dd>
            <span className="af-report-channel-bar" aria-hidden>
              <span style={{ width: `${(revenue / top) * 100}%` }} />
            </span>
          </div>
        ))}
        {!sorted.length && <Typography.Text type="secondary">Chưa có đơn trong kỳ.</Typography.Text>}
      </dl>
    </section>
  )
}

/** Bảng chi tiết vừa phần còn lại của màn hình: danh sách cuộn trong bảng, trang không phải cuộn. */
const reportTableHeight = 'max(240px, calc(100dvh - 540px))'

/** Tab có biểu đồ: xem bằng nút Bảng | Biểu đồ thay vì để biểu đồ đẩy bảng xuống. */
const chartTabs: string[] = ['products', 'delivery']

const shownColumns = (columns: ReportColumn[], core?: string[], extra: string[] = []) =>
  core ? columns.filter((column) => core.includes(column.key) || extra.includes(column.key)) : columns

/** Nút "Cột" cạnh hàng tab, chỉ cho bảng có cột phụ. */
function ColumnPicker({ columns, core, extra, onExtraChange }: {
  columns: ReportColumn[]
  core?: string[]
  extra: string[]
  onExtraChange: (keys: string[]) => void
}) {
  const optional = core ? columns.filter((column) => !core.includes(column.key)) : []
  if (!optional.length) return null
  return (
    <Popover trigger="click" placement="bottomRight" title="Cột thêm" content={
        <Checkbox.Group className="af-report-column-picker" value={extra} onChange={(keys) => onExtraChange(keys as string[])}
          options={optional.map((column) => ({ value: column.key, label: column.title }))} />
      }>
        <Button size="small" icon={<Columns3 size={15} />}>Cột{extra.length ? ` (+${extra.length})` : ''}</Button>
    </Popover>
  )
}

export function LiveReportsPage() {
  const staff = useStaff()
  return staff?.role === 'ADMIN' ? <LiveReportContent /> : <Alert type="warning" showIcon title="Chỉ ADMIN được xem báo cáo." />
}

/** Kỳ trên địa chỉ trang; sai định dạng, quá 366 ngày hoặc vượt hôm nay thì bỏ qua để dùng mặc định. */
function rangeFromParams(from: string | null, to: string | null, today: Dayjs): [Dayjs, Dayjs] | undefined {
  if (!from || !to) return undefined
  const start = dayjs(from)
  const end = dayjs(to)
  if (!start.isValid() || !end.isValid() || start.format('YYYY-MM-DD') !== from || end.format('YYYY-MM-DD') !== to) return undefined
  if (end.isBefore(start, 'day') || end.diff(start, 'day') > 365 || end.isAfter(today, 'day')) return undefined
  return [start, end]
}

/** Lịch chọn kỳ gọn hơn ô lịch mặc định (ô cao theo controlHeight 42 của app). */
const compactPicker = { components: { DatePicker: { cellHeight: 24, cellWidth: 32, textHeight: 32, presetsWidth: 110, presetsMaxWidth: 130 } } }

const CUSTOM_RANGE = 'Tùy chọn'
const quickRanges = ['Hôm nay', 'Tháng này', 'Tháng trước']

function LiveReportContent() {
  const { message } = App.useApp()
  const [granularity, setGranularity] = useState<Granularity>()
  // Kỳ, kênh, hình thức nằm trên địa chỉ trang (cùng tab) để tải lại hay gửi link vẫn đúng chỗ đang xem.
  const [search, setSearch] = useSearchParams()
  const today = dayjs(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()))
  const [rangeError, setRangeError] = useState<string>()
  // Mặc định tháng này: chủ đại lý chốt số theo tháng.
  const dates = rangeFromParams(search.get('from'), search.get('to'), today) ?? [today.startOf('month'), today]
  const channelParam = search.get('channel')
  const channel = channelParam && channelParam in channelLabels ? channelParam as ReportQuery['channel'] : undefined
  const methodParam = search.get('method')
  const method = methodParam === 'DELIVERY' || methodParam === 'COUNTER' ? methodParam : undefined
  const updateParams = (changes: Record<string, string | undefined>) => setSearch(params => {
    for (const [name, value] of Object.entries(changes)) {
      if (value) params.set(name, value)
      else params.delete(name)
    }
    return params
  }, { replace: true })
  const setDates = ([from, to]: [Dayjs, Dayjs]) => updateParams({ from: from.format('YYYY-MM-DD'), to: to.format('YYYY-MM-DD') })
  const setChannel = (value?: ReportQuery['channel']) => updateParams({ channel: value })
  const setMethod = (value?: ReportQuery['method']) => updateParams({ method: value })
  const [customRange, setCustomRange] = useState(false)
  const [view, setView] = useState<'table' | 'chart'>('table')
  const [extraColumns, setExtraColumns] = useState<Partial<Record<ReportSection, string[]>>>({})
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)
  const [exporting, setExporting] = useState(false)
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
  // Tồn kho tính cho cả cửa hàng: lọc kênh/hình thức không đổi số liệu nên khóa lại ở tab này.
  const filtersApply = tab !== 'inventory'
  return <Page title="Báo cáo"
    actions={<Button icon={<FileSpreadsheet size={16} />} loading={exporting} disabled={!report || summary.isError || (tab !== 'overview' && (details.isError || details.isPending)) || !rows.length} onClick={async () => {
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
      }} options={[...presets.map(({ label }) => label), CUSTOM_RANGE]} />
      {rangeMode === CUSTOM_RANGE && <ConfigProvider theme={compactPicker}><DatePicker.RangePicker className="af-report-range" separator="–" allowClear={false} value={dates} format="DD/MM/YYYY" presets={reportPresets(today).filter(({ label }) => !quickRanges.includes(label))} disabledDate={date => date.isAfter(today, 'day')}
        onChange={value => { if (value?.[0] && value[1]) { if (value[1].diff(value[0], 'day') > 365 || value[1].isAfter(today, 'day')) { setRangeError('Chọn tối đa 366 ngày và không vượt quá hôm nay.'); return }; setRangeError(undefined); setDates([value[0], value[1]]); setPage(0) } }} /></ConfigProvider>}
      <Select allowClear placeholder="Mọi kênh" disabled={!filtersApply} value={channel} className={filterOn(Boolean(channel))} style={{ width: 140 }} options={Object.entries(channelLabels).map(([value, label]) => ({ value, label }))} onChange={value => { setChannel(value); setPage(0) }} />
      <Select<NonNullable<ReportQuery['method']>> allowClear placeholder="Mọi hình thức" disabled={!filtersApply} value={method} className={filterOn(Boolean(method))} style={{ width: 150 }} options={[{ value: 'DELIVERY', label: 'Giao tận nơi' }, { value: 'COUNTER', label: 'Tại quầy' }]} onChange={value => { setMethod(value); setPage(0) }} />
      {(channel || method) && <Button type="link" icon={<FunnelX size={15} />} onClick={() => { updateParams({ channel: undefined, method: undefined }); setPage(0) }}>Xóa lọc</Button>}
    </div>
    {rangeError && <Alert type="warning" showIcon title={rangeError} />}
    {summary.isError ? <QueryError error={summary.error} onRetry={summary.refetch} /> : <>
      <div className="af-report-kpis">
        {kpis.map(({ title, key, money }) => {
          const value = Number(report?.sales[key] ?? 0)
          return <Kpi key={key} title={title} loading={summary.isPending} value={money ? currency(value) : value} note={report && <>
            <Delta current={value} previous={previous.data?.sales[key]} />
            {key === 'ordersCreated' && report.sales.ordersCancelled > 0 && <span className="af-report-delta">{report.sales.ordersCancelled} đơn đã hủy</span>}
          </>} />
        })}
        <Kpi title="Lãi gộp ước tính" loading={summary.isPending}
          value={report && report.sales.unpricedCostLines === 0 ? currency(Number(report.sales.estimatedGrossProfit ?? 0)) : 'Chưa đủ giá nhập'}
          note={report && report.sales.totalCostLines > 0 && report.sales.unpricedCostLines > 0 && <span className="af-report-delta is-down">Thiếu giá nhập cho {report.sales.unpricedCostLines}/{report.sales.totalCostLines} dòng hàng</span>} />
      </div>
      {!!report?.sales.undatedDeliveredOrders && <Alert type="warning" showIcon title={`Có ${report.sales.undatedDeliveredOrders} đơn đã giao thiếu thời điểm giao, chưa thể tính vào doanh thu theo kỳ.`} />}
      <Tabs activeKey={tab} tabBarExtraContent={tab !== 'overview' && <div className="af-report-tab-tools">
        {chartTabs.includes(tab) && <Segmented<'table' | 'chart'> size="small" aria-label="Kiểu xem" value={view} onChange={setView} options={[{ value: 'table', label: 'Bảng' }, { value: 'chart', label: 'Biểu đồ' }]} />}
        {(view === 'table' || !chartTabs.includes(tab)) && <ColumnPicker columns={sections[tab].columns} core={coreColumns[tab]} extra={extraColumns[tab] ?? []}
          onExtraChange={(keys) => setExtraColumns((previous) => ({ ...previous, [tab]: keys }))} />}
      </div>} onChange={key => { setSearch(params => { params.set('tab', key); return params }, { replace: true }); setPage(0) }} items={[
        { key: 'overview', label: 'Tổng quan', children: report && <>
          <Card title="Doanh thu và thanh toán theo kỳ" extra={<Segmented<Granularity> size="small" aria-label="Gom biểu đồ theo" value={unit} onChange={setGranularity} options={(Object.keys(granularityLabels) as Granularity[]).map((value) => ({ value, label: granularityLabels[value] }))} />}><RevenueChart data={groupRevenue(report.days, unit)} /></Card>
          <Card className="af-report-overview">
            <div className="af-report-overview-grid">
              <ReportList title="Đối chiếu doanh thu" lines={[
                { label: 'Tiền hàng đã giao', value: report.sales.goods, money: true },
                { label: '− Giảm giá', value: report.sales.discounts, money: true },
                { label: '+ Phí giao', value: report.sales.deliveryFees, money: true },
                { label: '− Hàng khách trả', value: report.sales.returnsValue, money: true },
                { label: 'Doanh thu', value: report.sales.revenue, money: true, total: true },
              ]} />
              <ReportList title="Thanh toán đã xác nhận" lines={[
                { label: 'Tiền mặt', value: report.sales.cashIn, money: true },
                { label: 'Chuyển khoản', value: report.sales.transferIn, money: true },
                { label: '− Chi hoàn', value: report.sales.refunds, money: true },
                { label: 'Đã thu', value: report.sales.netPayments, money: true, total: true },
              ]} />
              <ChannelList channels={report.channels} />
            </div>
          </Card>
          <Card className="af-report-overview">
            <ReportList title="Sổ cọc và vỏ bình toàn cửa hàng" columns lines={[
              { label: 'Số dư cọc cuối kỳ', value: report.deposits.held, money: true },
              { label: 'Vỏ còn ngoài cửa hàng', value: report.deposits.bottlesHeld },
              { label: 'Thu cọc trong kỳ', value: report.deposits.collected, money: true },
              { label: 'Hoàn cọc trong kỳ', value: report.deposits.refunded, money: true },
              { label: 'Cọc cấn trừ mất/vỡ', value: report.deposits.forfeited ?? 0, money: true },
              { label: 'Cọc chưa đủ nghĩa vụ vỏ', value: report.deposits.uncoveredDeposit, money: true },
              { label: 'Vỏ giao kèm', value: report.deposits.bottlesGiven },
              { label: 'Vỏ thu lại', value: report.deposits.bottlesReceived },
              { label: 'Vỏ mất / vỡ', value: report.deposits.bottlesLost },
            ]} />
          </Card>
        </> },
        ...Object.entries(sections).map(([key, section]) => ({ key, label: section.title, children: details.isError ? <QueryError error={details.error} onRetry={details.refetch} /> : <Card>
          {chartTabs.includes(key) && view === 'chart' ? (
            details.isPending ? <Typography.Text type="secondary">Đang tải báo cáo…</Typography.Text>
              : !detailRows.length ? <Typography.Text type="secondary">Chưa có dữ liệu trong kỳ.</Typography.Text>
              : <>
                <Typography.Text type="secondary" className="af-report-chart-note">{key === 'products' ? '8 sản phẩm doanh thu cao nhất' : '8 tài xế nhiều lượt giao nhất'} trong trang đang xem. Đủ số liệu xem ở chế độ Bảng.</Typography.Text>
                {key === 'products' ? <TopProductsChart rows={detailRows.map((row) => ({ name: String(row.name), unit: String(row.unit), sold: num(row.sold), revenue: num(row.revenue) }))} /> : <DriverDeliveryChart rows={detailRows.map((row) => ({ driver: String(row.driver), delivered: num(row.delivered), late: num(row.late), failed: num(row.failed) }))} />}
              </>
          ) : (
            <Table<ReportRow> className="af-report-table" size="middle" rowKey={section.key} loading={details.isPending} columns={key === 'customers' ? customerColumns : columnsOf(shownColumns(section.columns, coreColumns[key as ReportSection], extraColumns[key as ReportSection]))} dataSource={details.data?.content ?? []} scroll={{ x: tableWidthOf(shownColumns(section.columns, coreColumns[key as ReportSection], extraColumns[key as ReportSection])), y: reportTableHeight }} locale={{ emptyText: details.isPending ? 'Đang tải báo cáo…' : 'Chưa có dữ liệu trong kỳ.' }}
            pagination={{ current: page + 1, pageSize: size, total: details.data?.totalElements ?? 0, showSizeChanger: true, pageSizeOptions: [20, 50, 100], onChange: (next, nextSize) => { setPage(nextSize === size ? next - 1 : 0); setSize(nextSize) } }} />
          )}
        </Card> })),
      ]} />
    </>}
  </Page>
}
