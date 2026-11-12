import { useState } from 'react'
import { fontSizes } from '@/app/typography'
import { useQuery } from '@tanstack/react-query'
import { Alert, Card, Col, DatePicker, Empty, Row, Space, Statistic, Tooltip, Typography } from 'antd'
import { Info } from 'lucide-react'
import dayjs, { type Dayjs } from 'dayjs'
import { Link } from 'react-router'
import { reportApi } from '@/features/reports/reportApi'
import { autoGranularity, groupRevenue, reportPresets } from '@/features/reports/periods'
import { useStaff } from '@/features/auth/useStaff'
import { canOpen } from '@/features/auth/permissions'
import { QueryError } from '@/shared/components/QueryError'
import { BarChart } from '@/shared/components/BarChart'
import { currency, compactCurrency } from '@/shared/utils/format'

/** Do not mount report queries for roles without access, including cached admin data. */
export function DashboardMetrics() {
  const staff = useStaff()
  return staff && canOpen(staff.role, '/reports') ? <Metrics /> : null
}

function Metrics() {
  const today = dayjs(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()))
  const [dates, setDates] = useState<[Dayjs, Dayjs]>([today.startOf('month'), today])
  const [rangeError, setRangeError] = useState<string>()
  const range = { from: dates[0].format('YYYY-MM-DD'), to: dates[1].format('YYYY-MM-DD') }
  const summary = useQuery({
    queryKey: ['dashboard', 'live', 'summary', range],
    queryFn: () => reportApi.summary(range),
  })
  const sales = summary.data?.sales
  const metrics = [
    ['Tổng đơn', sales?.ordersCreated, false], ['Doanh thu', sales?.revenue, true],
    ['AOV', sales?.averageOrderValue, true], ['Đơn đã giao', sales?.ordersDelivered, false],
    ['Đơn đã hủy', sales?.ordersCancelled, false], ['Khách hàng mới', sales?.newCustomers, false],
  ] as const
  const empty = sales && [sales.ordersCreated, sales.ordersDelivered, sales.ordersCancelled, sales.revenue, sales.newCustomers].every(value => Number(value) === 0)
  const buckets = groupRevenue(summary.data?.days ?? [], autoGranularity(range))

  return <section aria-label="Thống kê kinh doanh" style={{ marginTop: 24 }}>
    <Space wrap style={{ marginBottom: 16 }}>
      <Typography.Title level={3} style={{ margin: 0 }}>Kết quả kinh doanh</Typography.Title>
      <Tooltip title={<>Số liệu theo giờ Việt Nam. AOV = doanh thu / số đơn đã giao; không có đơn thì bằng 0.
       Doanh thu không gồm phí giao và tiền cọc. Khách mới tính theo ngày tạo hồ sơ, không gồm khách vãng lai. Tổng đơn tính theo ngày tạo; đơn đã giao và hủy tính theo ngày giao hoặc hủy trong kỳ.</>}>
        <Info size={16} aria-label="Cách tính số liệu" tabIndex={0} />
      </Tooltip>
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
      <Link to="/reports?tab=customers" className="af-text-link">Khách hàng mua nhiều</Link>
    </Space>
    {rangeError && <Alert type="warning" showIcon title={rangeError} />}
    {summary.isError ? <QueryError error={summary.error} onRetry={summary.refetch} /> : <>
      <Row gutter={[16, 16]}>
        {metrics.map(([title, value, money]) => <Col xs={12} sm={8} xl={4} key={title}>
          <Card size="small" loading={summary.isPending}><Statistic title={title} styles={{ content: { fontSize: fontSizes.xl } }} value={value === undefined ? '—' : money ? currency(Math.round(Number(value))) : Number(value)} /></Card>
        </Col>)}
      </Row>
      {sales?.netPayments !== undefined && <p>Thanh toán ròng đã xác nhận trong kỳ: <strong>{currency(Number(sales.netPayments))}</strong></p>}
      {!summary.isPending && empty && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dữ liệu kinh doanh trong kỳ." />}
      <Card title="Doanh thu trong kỳ" loading={summary.isPending} style={{ marginTop: 16 }}>
        {!buckets.some(row => row.revenue !== 0) ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có doanh thu trong kỳ." />
          : <BarChart data={buckets.map(row => ({ label: row.label, value: row.revenue }))} formatValue={compactCurrency} height={210} />}
      </Card>
    </>}
  </section>
}
