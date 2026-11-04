import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, App, Button, Card, Col, DatePicker, Descriptions, Row, Select, Space, Statistic, Table, Tabs, Typography } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { useSearchParams } from 'react-router'
import { Page } from '@/shared/components/Page'
import { QueryError } from '@/shared/components/QueryError'
import { currency } from '@/shared/utils/format'
import { reportApi, channelLabels, type ReportQuery, type ReportSection, type ReportRow } from './reportApi'
import { RevenueChart } from './charts'
import { autoGranularity, groupRevenue } from './periods'
import { previousRange } from './reportService'
import type { ReportColumn } from './exportLiveReport'
import './reports.css'

const sections: Record<ReportSection, { title: string; key: string; columns: ReportColumn[] }> = {
  products: { title: 'Sản phẩm bán', key: 'productId', columns: [
    { key: 'sku', title: 'Mã hàng' }, { key: 'name', title: 'Sản phẩm' }, { key: 'unit', title: 'Đơn vị' }, { key: 'sold', title: 'SL đã giao' }, { key: 'returned', title: 'SL khách trả' }, { key: 'revenue', title: 'Tiền hàng sau giảm giá / trả lại', money: true },
  ] },
  inventory: { title: 'Nhập – xuất – tồn', key: 'productId', columns: [
    { key: 'name', title: 'Sản phẩm' }, { key: 'unit', title: 'Đơn vị' }, { key: 'opening', title: 'Tồn đầu' }, { key: 'received', title: 'Nhập NCC' }, { key: 'restocked', title: 'Hoàn nhập kho' }, { key: 'issued', title: 'Xuất kho' }, { key: 'adjustments', title: 'Điều chỉnh (+/−)' }, { key: 'closing', title: 'Tồn cuối' }, { key: 'damaged', title: 'Loại khi nhận NCC' }, { key: 'discarded', title: 'Loại khi hoàn hàng' },
  ] },
  delivery: { title: 'Giao hàng', key: 'driverId', columns: [
    { key: 'driver', title: 'Tài xế' }, { key: 'delivered', title: 'Lần giao thành công' }, { key: 'failed', title: 'Lần thất bại' }, { key: 'appointed', title: 'Giao có hẹn' }, { key: 'late', title: 'Giao trễ hẹn' }, { key: 'settledTrips', title: 'Chuyến đối soát' }, { key: 'cashReported', title: 'Tiền báo nộp', money: true }, { key: 'cashConfirmed', title: 'Tiền xác nhận nhận', money: true }, { key: 'cashDifference', title: 'Chênh lệch báo − nhận', money: true },
  ] },
  customers: { title: 'Khách hàng', key: 'key', columns: [
    { key: 'name', title: 'Khách hàng' }, { key: 'orders', title: 'Đơn giao trong kỳ' }, { key: 'revenue', title: 'Doanh thu sau hàng trả', money: true },
  ] },
}
const dailyColumns: ReportColumn[] = [{ key: 'date', title: 'Ngày' }, { key: 'revenue', title: 'Doanh thu', money: true }, { key: 'collected', title: 'Thanh toán ròng', money: true }, { key: 'orders', title: 'Đơn tạo' }]
const columnsOf = (columns: ReportColumn[]) => columns.map(column => ({ title: column.title, dataIndex: column.key, key: column.key, render: (value: string | number | null) => column.money ? currency(Number(value ?? 0)) : value, width: column.money ? 180 : 140 }))

export function LiveReportsPage() {
  const { message } = App.useApp()
  const [dates, setDates] = useState<[Dayjs, Dayjs]>([dayjs().subtract(29, 'day'), dayjs()])
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
  const report = summary.data
  const selectedSection = tab === 'overview' ? undefined : sections[tab]
  const rows: ReportRow[] = tab === 'overview' ? report?.days ?? [] : details.data?.content ?? []
  const columns = selectedSection?.columns ?? dailyColumns
  return <Page title="Báo cáo" description="Doanh thu, thanh toán, kho và giao hàng từ dữ liệu thực tế, theo ngày Việt Nam."
    actions={<Space wrap>
      <DatePicker.RangePicker allowClear={false} value={dates} format="DD/MM/YYYY" disabledDate={date => date.isAfter(dayjs(), 'day')}
        onChange={value => { if (value?.[0] && value[1]) { setDates([value[0], value[1]]); setPage(0) } }} />
      <Select allowClear placeholder="Mọi kênh" value={channel} style={{ width: 150 }} options={Object.entries(channelLabels).map(([value, label]) => ({ value, label }))} onChange={value => { setChannel(value); setPage(0) }} />
      <Select allowClear placeholder="Mọi hình thức" value={method} style={{ width: 170 }} options={[{ value: 'DELIVERY', label: 'Giao tận nơi' }, { value: 'COUNTER', label: 'Tại quầy' }]} onChange={value => { setMethod(value); setPage(0) }} />
      <Button onClick={() => { void summary.refetch(); void previous.refetch(); if (tab !== 'overview') void details.refetch() }}>Làm mới</Button>
      <Button loading={exporting} disabled={!report || summary.isError || (tab !== 'overview' && (details.isError || details.isPending)) || !rows.length} onClick={async () => {
        if (!report) return
        setExporting(true)
        try { const { downloadLiveReport } = await import('./exportLiveReport'); await downloadLiveReport(report, query, selectedSection?.title ?? 'Doanh thu theo ngày', columns, rows, tab === 'overview' ? undefined : page) }
        catch { message.error('Không thể xuất báo cáo. Vui lòng thử lại.') }
        finally { setExporting(false) }
      }}>{tab === 'overview' ? 'Xuất Excel theo ngày' : 'Xuất Excel trang này'}</Button>
    </Space>}>
    <Alert type="info" showIcon title="Kỳ báo cáo tối đa 366 ngày, gồm cả ngày bắt đầu và kết thúc."
      description="Kênh và hình thức áp dụng cho doanh thu, thanh toán, sản phẩm, khách hàng và kết quả giao. Kho, nhập hàng, sổ cọc và đối soát tài xế tính cho cả cửa hàng." />
    {summary.isError ? <QueryError error={summary.error} onRetry={summary.refetch} /> : <>
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {[['Doanh thu sau giảm giá / hàng trả', report?.sales.revenue, true], ['Thanh toán ròng đã xác nhận', report?.sales.netPayments, true], ['Đơn đã giao trong kỳ', report?.sales.ordersDelivered, false], ['Đơn tạo trong kỳ', report?.sales.ordersCreated, false]].map(([title, value, money]) => <Col xs={24} sm={12} xl={6} key={String(title)}><Card loading={summary.isPending}><Statistic title={title} value={money ? currency(Number(value ?? 0)) : Number(value ?? 0)} /></Card></Col>)}
      </Row>
      {report && <p>Doanh thu kỳ trước: {previous.isError ? 'Không tải được' : previous.isPending ? 'Đang tải…' : currency(previous.data?.sales.revenue ?? 0)} · Đơn hủy trong kỳ: {report.sales.ordersCancelled}</p>}
      {!!report?.sales.undatedDeliveredOrders && <Alert type="warning" showIcon title={`Có ${report.sales.undatedDeliveredOrders} đơn đã giao thiếu thời điểm giao, chưa thể tính vào doanh thu theo kỳ.`} />}
      <Tabs activeKey={tab} onChange={key => { setSearch(params => { params.set('tab', key); return params }, { replace: true }); setPage(0) }} items={[
        { key: 'overview', label: 'Tổng quan', children: report && <>
          <Card title="Doanh thu và thanh toán theo kỳ"><RevenueChart data={groupRevenue(report.days, autoGranularity(query))} /></Card>
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}><Col xs={24} lg={12}><Card title="Đối chiếu doanh thu"><Descriptions column={1} items={[
            { key: 'goods', label: 'Tiền hàng đã giao', children: currency(report.sales.goods) },
            { key: 'discounts', label: 'Giảm giá', children: currency(report.sales.discounts) },
            { key: 'fees', label: 'Phí giao', children: currency(report.sales.deliveryFees) },
            { key: 'returns', label: 'Hàng khách trả trong kỳ', children: currency(report.sales.returnsValue) },
          ]} /><Typography.Text type="secondary">Hoàn kho của đơn giao thất bại không trừ doanh thu lần nữa. Giá vốn và lãi gộp chưa được tính do chưa có giá vốn chốt theo lần bán.</Typography.Text></Card></Col>
          <Col xs={24} lg={12}><Card title="Thanh toán đã xác nhận"><Descriptions column={1} items={[
            { key: 'cash', label: 'Thu tiền mặt', children: currency(report.sales.cashIn) }, { key: 'bank', label: 'Thu chuyển khoản', children: currency(report.sales.transferIn) }, { key: 'refunds', label: 'Chi hoàn', children: currency(report.sales.refunds) },
          ]} /><Typography.Text type="secondary">Tính theo thời điểm xác nhận thanh toán, có thể gồm tiền cọc trong khoản thu. Tiền tài xế bàn giao không được cộng lần nữa.</Typography.Text></Card></Col></Row>
          <Card title="Theo kênh" style={{ marginTop: 16 }}><Table rowKey="channel" pagination={false} dataSource={report.channels} columns={[{ title: 'Kênh', dataIndex: 'channel', render: (v: keyof typeof channelLabels) => channelLabels[v] }, { title: 'Đơn tạo', dataIndex: 'orders' }, { title: 'Doanh thu', dataIndex: 'revenue', render: currency }]} /></Card>
          <Card title="Nhập hàng và sổ cọc toàn cửa hàng" style={{ marginTop: 16 }}><Descriptions column={2} items={[
            { key: 'receipts', label: 'Phiếu nhập xác nhận', children: report.receipts.count }, { key: 'value', label: 'Giá trị hàng đạt nhập', children: currency(report.receipts.value) },
            { key: 'deposit', label: 'Số dư cọc cuối kỳ', children: currency(report.deposits.held) }, { key: 'bottles', label: 'Vỏ còn ngoài cửa hàng', children: report.deposits.bottlesHeld },
            { key: 'collected', label: 'Thu cọc trong kỳ', children: currency(report.deposits.collected) }, { key: 'refunded', label: 'Hoàn cọc trong kỳ', children: currency(report.deposits.refunded) },
          ]} /><Typography.Text type="secondary">Sổ cọc/vỏ chỉ phản ánh giao dịch đã lưu; không suy từ đơn hàng.</Typography.Text></Card>
        </> },
        ...Object.entries(sections).map(([key, section]) => ({ key, label: section.title, children: details.isError ? <QueryError error={details.error} onRetry={details.refetch} /> : <Card>
          {key === 'inventory' && <p>Tồn đầu + nhập NCC + hoàn nhập + điều chỉnh − xuất = tồn cuối. Hàng loại bỏ không nhập vào tồn. Số dư lịch sử được tính lùi từ tồn hiện tại và sổ kho.</p>}
          {key === 'delivery' && <p>Kết quả tính theo từng lần giao; đối soát tính theo ngày bàn giao và không phải doanh thu hay thanh toán của khách.</p>}
          {key === 'customers' && <p>Khách chưa gắn hồ sơ được gộp vào Khách vãng lai.</p>}
          <Table<ReportRow> rowKey={section.key} loading={details.isPending} columns={columnsOf(section.columns)} dataSource={details.data?.content ?? []} scroll={{ x: key === 'inventory' || key === 'delivery' ? 1500 : 900 }} locale={{ emptyText: 'Chưa có dữ liệu trong kỳ.' }}
            pagination={{ current: page + 1, pageSize: size, total: details.data?.totalElements ?? 0, showSizeChanger: true, pageSizeOptions: [20, 50, 100], onChange: (next, nextSize) => { setPage(nextSize === size ? next - 1 : 0); setSize(nextSize) } }} />
        </Card> })),
      ]} />
    </>}
  </Page>
}
