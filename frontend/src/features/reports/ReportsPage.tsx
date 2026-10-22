import { useState } from 'react'
import { App, Button, Card, Col, DatePicker, Descriptions, Empty, Progress, Row, Statistic, Table, Tag, Typography, type TableColumnsType } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { Download } from 'lucide-react'
import { BarChart } from '../../shared/components/BarChart'
import { Money } from '../../shared/components/Money'
import { Page } from '../../shared/components/Page'
import { PanelHeading } from '../../shared/components/PanelHeading'
import { QueryError } from '../../shared/components/QueryError'
import { compactCurrency, currency, shortDate } from '../../shared/utils/format'
import { tablePagination, tableScrollHeight } from '../../shared/utils/table'
import { useReport, type DriverReportRow, type PeriodReport, type ProductReportRow, type ReportRange } from './reportService'

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
  { title: 'Nhập đạt', dataIndex: 'received', align: 'right', width: 90, render: (value: number) => value || '—' },
  { title: 'Đã bán', dataIndex: 'sold', align: 'right', width: 90, sorter: (a, b) => a.sold - b.sold },
  { title: 'Trả lại', dataIndex: 'returned', align: 'right', width: 80, render: (value: number) => value || '—' },
  { title: 'Tồn hiện tại', dataIndex: 'stock', align: 'right', width: 110, render: (stock: number, row) => `${stock} ${row.unit.toLowerCase()}` },
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

const driverColumns: TableColumnsType<DriverReportRow> = [
  { title: 'Tài xế', dataIndex: 'driver', ellipsis: true },
  { title: 'Thành công', dataIndex: 'delivered', align: 'right', width: 100 },
  { title: 'Thất bại', dataIndex: 'failed', align: 'right', width: 90, render: (value: number) => (value ? <Tag color="red">{value}</Tag> : 0) },
  { title: 'Trễ hẹn', dataIndex: 'late', align: 'right', width: 90, render: (value: number) => (value ? <Tag color="orange">{value}</Tag> : 0) },
]

export function ReportsPage() {
  const { message } = App.useApp()
  const [exporting, setExporting] = useState(false)
  const [dates, setDates] = useState<[Dayjs, Dayjs]>(presets[2].value)
  const range = toRange(dates)
  const reportQuery = useReport(range)
  const report = reportQuery.data
  const loading = reportQuery.isPending
  const best = report?.days.reduce<PeriodReport['days'][number] | undefined>((top, day) => (!top || day.revenue > top.revenue ? day : top), undefined)
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
          <Button
            icon={<Download size={16} />}
            disabled={!report}
            loading={exporting}
            onClick={async () => {
              if (!report || exporting) return
              setExporting(true)
              try {
                const { downloadReportExcel } = await import('./exportReport')
                await downloadReportExcel(report)
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
      {reportQuery.isError ? (
        <Card>
          <QueryError error={reportQuery.error} onRetry={reportQuery.refetch} />
        </Card>
      ) : (
        <>
          <Row gutter={[16, 16]} className="af-stat-row">
            <Col xs={24} sm={12} xl={6}>
              <Card loading={loading}>
                <Statistic title="Doanh thu (đơn đã giao)" value={currency(report?.sales.revenue ?? 0)} />
                <Typography.Text type="secondary">
                  {report?.sales.delivered ?? 0} đơn · TB {currency(report?.sales.averageOrder ?? 0)}
                </Typography.Text>
              </Card>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <Card loading={loading}>
                <Statistic className="af-stat-paid" title="Tiền thực thu" value={currency(report?.cash.collected ?? 0)} />
                <Typography.Text type="secondary">Đã trừ hoàn {currency(report?.cash.refunds ?? 0)}</Typography.Text>
              </Card>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <Card loading={loading}>
                <Statistic className={(report?.profit.gross ?? 0) < 0 ? 'af-stat-refund' : 'af-stat-paid'} title="Lãi gộp ước tính" value={currency(report?.profit.gross ?? 0)} />
                <Typography.Text type="secondary">Biên {margin}% · giá vốn bình quân lô</Typography.Text>
              </Card>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <Card loading={loading}>
                <Statistic title="Đơn tạo trong kỳ" value={report?.sales.orders ?? 0} />
                <Typography.Text type="secondary">{report?.sales.cancelled ?? 0} đơn hủy</Typography.Text>
              </Card>
            </Col>
          </Row>
          <Row gutter={[16, 16]}>
            <Col xs={24} xl={15}>
              <Card
                title={<PanelHeading title="Doanh thu theo ngày" extra={best && best.revenue > 0 && <Typography.Text type="secondary">Cao nhất {shortDate(best.date)}: {compactCurrency(best.revenue)}</Typography.Text>} />}
                className="af-card af-fill"
                loading={loading}
              >
                {report?.days.some((day) => day.revenue > 0) ? (
                  <BarChart data={report.days.map((day) => ({ label: shortDate(day.date).slice(3), value: day.revenue }))} formatValue={compactCurrency} height={240} />
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có doanh thu trong kỳ." />
                )}
              </Card>
            </Col>
            <Col xs={24} xl={9}>
              <Card title="Tiền, cọc và vỏ" className="af-card af-fill" loading={loading}>
                {report && (
                  <Descriptions
                    size="small"
                    column={1}
                    items={[
                      { key: 'cash', label: 'Thu tiền mặt', children: <Money value={report.cash.cash} tone="paid" /> },
                      { key: 'transfer', label: 'Thu chuyển khoản', children: <Money value={report.cash.transfer} tone="paid" /> },
                      { key: 'refunds', label: 'Hoàn tiền cho khách', children: <Money value={report.cash.refunds} tone="refund" /> },
                      { key: 'returns', label: 'Hàng khách trả lại', children: <Money value={report.sales.returnsValue} tone="refund" /> },
                      { key: 'fees', label: 'Phí giao đã tính', children: currency(report.sales.deliveryFees) },
                      { key: 'deposit', label: 'Cọc vỏ thu / hoàn', children: (
                          <>
                            <Money value={report.deposits.collected} tone="deposit" /> / <Money value={report.deposits.refunded} tone="refund" />
                          </>
                        ),
                      },
                      { key: 'bottles', label: 'Vỏ giao / thu / mất', children: `${report.deposits.bottlesOut} / ${report.deposits.bottlesBack} / ${report.deposits.bottlesLost}` },
                      { key: 'receipts', label: 'Nhập hàng', children: `${report.receipts.count} phiếu · ${currency(report.receipts.value)}` },
                    ]}
                  />
                )}
                <p className="af-form-hint">Tiền cọc vỏ ghi sổ riêng, không tính vào doanh thu.</p>
              </Card>
            </Col>
          </Row>
          <Row gutter={[16, 16]}>
            <Col xs={24} xl={14}>
              <Card title="Giao hàng" className="af-card af-fill" loading={loading} styles={{ body: { paddingTop: 12 } }}>
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
                    <Table<DriverReportRow>
                      rowKey="driver"
                      size="small"
                      className="af-data-table"
                      pagination={false}
                      columns={driverColumns}
                      dataSource={report.delivery.drivers}
                      locale={{ emptyText: 'Chưa có lượt giao trong kỳ.' }}
                      scroll={{ x: 420 }}
                    />
                  </>
                )}
              </Card>
            </Col>
            <Col xs={24} xl={10}>
              <Card title="Theo kênh tiếp nhận" className="af-card af-fill" loading={loading} styles={{ body: { padding: 0 } }}>
                {report && (
                  <Table
                    rowKey="channel"
                    size="middle"
                    className="af-data-table"
                    pagination={false}
                    dataSource={report.channels}
                    scroll={{ x: 360 }}
                    columns={[
                      { title: 'Kênh', dataIndex: 'channel' },
                      { title: 'Đơn tạo', dataIndex: 'orders', align: 'right', width: 110 },
                      { title: 'Doanh thu', dataIndex: 'revenue', align: 'right', width: 140, render: currency },
                    ]}
                  />
                )}
              </Card>
            </Col>
          </Row>
          <Card title="Nhập – xuất – tồn theo sản phẩm" className="af-card" styles={{ body: { padding: 0 } }}>
            <Table<ProductReportRow>
              locale={{ emptyText: 'Không có hàng nhập hoặc bán trong kỳ.' }}
              className="af-data-table"
              rowKey="productId"
              size="middle"
              columns={productColumns}
              dataSource={report?.products}
              loading={loading}
              pagination={tablePagination}
              scroll={{ x: 1050, y: tableScrollHeight }}
            />
          </Card>
        </>
      )}
    </Page>
  )
}
