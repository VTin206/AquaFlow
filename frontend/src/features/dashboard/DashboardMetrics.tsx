import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Card, Col, DatePicker, Empty, Row, Space, Statistic, Table, Typography } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { Link } from 'react-router'
import { reportApi, type ReportRow } from '@/features/reports/reportApi'
import { reportService } from '@/features/reports/reportService'
import { autoGranularity, groupRevenue, reportPresets } from '@/features/reports/periods'
import { useStaff } from '@/features/auth/useStaff'
import { canOpen } from '@/features/auth/permissions'
import { QueryError } from '@/shared/components/QueryError'
import { BarChart } from '@/shared/components/BarChart'
import { currency, compactCurrency } from '@/shared/utils/format'

/** Do not mount report queries for roles without access, including cached admin data. */
export function DashboardMetrics() {
  const staff = useStaff()
  return staff && canOpen(staff.role, '/reports') ? <Metrics demo={staff.isDemo} /> : null
}

function Metrics({ demo }: { demo: boolean }) {
  const today = dayjs(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()))
  const [dates, setDates] = useState<[Dayjs, Dayjs]>([today.startOf('month'), today])
  const [rangeError, setRangeError] = useState<string>()
  const range = { from: dates[0].format('YYYY-MM-DD'), to: dates[1].format('YYYY-MM-DD') }
  const summary = useQuery({
    queryKey: ['dashboard', demo ? 'demo' : 'live', 'summary', range],
    queryFn: async () => {
      if (!demo) return reportApi.summary(range)
      const report = await reportService.summary(range)
      return { sales: { ordersCreated: report.sales.orders, ordersDelivered: report.sales.delivered,
        ordersCancelled: report.sales.cancelled, revenue: report.sales.net, averageOrderValue: report.sales.delivered ? report.sales.net / report.sales.delivered : 0,
        newCustomers: report.customers.new, netPayments: report.cash.collected }, days: report.days }
    },
  })
  const customers = useQuery({
    queryKey: ['dashboard', demo ? 'demo' : 'live', 'customers', range],
    queryFn: async (): Promise<ReportRow[]> => {
      if (!demo) return (await reportApi.section('customers', range, 0, 10)).content
      return (await reportService.summary(range)).customers.top.map(row => ({ key: row.key, name: row.name, orders: row.orders, revenue: row.revenue }))
    },
  })
  const sales = summary.data?.sales
  const metrics = [
    ['Tổng đơn', sales?.ordersCreated, false], ['Doanh thu', sales?.revenue, true],
    ['AOV', sales?.averageOrderValue, true], ['Đơn đã giao', sales?.ordersDelivered, false],
    ['Đơn đã hủy', sales?.ordersCancelled, false], ['Khách hàng mới', sales?.newCustomers, false],
  ] as const
  const empty = sales && [sales.ordersCreated, sales.ordersDelivered, sales.ordersCancelled, sales.revenue, sales.newCustomers].every(value => Number(value) === 0)
  const buckets = groupRevenue(summary.data?.days ?? [], autoGranularity(range))

  return <section aria-label="Thống kê kinh doanh">
    <Space wrap style={{ marginBottom: 16 }}>
      <Typography.Title level={3} style={{ margin: 0 }}>Kết quả kinh doanh</Typography.Title>
      <DatePicker.RangePicker aria-label="Kỳ thống kê" value={dates} allowClear={false} format="DD/MM/YYYY"
        presets={reportPresets(today)} disabledDate={date => date.isAfter(today, 'day')}
        onChange={values => {
          if (!values?.[0] || !values[1]) return
          if (values[1].diff(values[0], 'day') > 365 || values[1].isAfter(today, 'day')) {
            setRangeError('Chọn tối đa 366 ngày và không vượt quá hôm nay.')
            return
          }
          setRangeError(undefined)
          setDates([values[0], values[1]])
        }} />
    </Space>
    {rangeError && <Alert type="warning" showIcon title={rangeError} />}
    <p>Số liệu theo giờ Việt Nam. AOV = doanh thu / số đơn đã giao; không có đơn thì bằng 0.
      {demo ? ' Dữ liệu Demo: khách mới tính theo lần mua đầu tiên.' : ' Doanh thu không gồm phí giao và tiền cọc. Khách mới tính theo ngày tạo hồ sơ, không gồm khách vãng lai.'}</p>
    <p>Tổng đơn tính theo ngày tạo; đơn đã giao và hủy tính theo ngày giao hoặc hủy trong kỳ.</p>
    {summary.isError ? <QueryError error={summary.error} onRetry={summary.refetch} /> : <>
      <Row gutter={[16, 16]}>
        {metrics.map(([title, value, money]) => <Col xs={24} sm={12} xl={8} key={title}>
          <Card loading={summary.isPending}><Statistic title={title} value={value === undefined ? '—' : money ? currency(Number(value)) : Number(value)} /></Card>
        </Col>)}
      </Row>
      {sales?.netPayments !== undefined && <p>Thanh toán ròng đã xác nhận trong kỳ: <strong>{currency(Number(sales.netPayments))}</strong></p>}
      {!summary.isPending && empty && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dữ liệu kinh doanh trong kỳ." />}
      <Card title="Doanh thu trong kỳ" loading={summary.isPending} style={{ marginTop: 16 }}>
        {!buckets.some(row => row.revenue !== 0) ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có doanh thu trong kỳ." />
          : <BarChart data={buckets.map(row => ({ label: row.label, value: row.revenue }))} formatValue={compactCurrency} height={210} />}
      </Card>
    </>}
    <Card title="Khách hàng mua nhiều" style={{ marginTop: 16, marginBottom: 24 }}>
      <p>10 khách/nhóm khách có doanh thu sau hàng trả cao nhất trong cùng kỳ. Khách vãng lai được gom thành nhóm riêng, không có hồ sơ để mở.</p>
      {customers.isError ? <QueryError error={customers.error} onRetry={customers.refetch} />
        : <Table<ReportRow> rowKey="key" loading={customers.isPending} dataSource={customers.data ?? []} pagination={false}
          scroll={{ x: 550 }} locale={{ emptyText: customers.isPending ? 'Đang tải khách hàng…' : 'Chưa có khách hàng mua trong kỳ.' }} columns={[
            { title: 'Khách hàng', dataIndex: 'name', render: (name: string, row) => row.key === 'guest' || String(row.key).startsWith('SĐT ') || !row.key ? name
              : <Link to={`/customers?customerId=${encodeURIComponent(String(row.key))}`}>{name}</Link> },
            { title: 'Đơn đã giao', dataIndex: 'orders' },
            { title: 'Doanh thu', dataIndex: 'revenue', render: value => currency(Number(value)) },
          ]} />}
    </Card>
  </section>
}
