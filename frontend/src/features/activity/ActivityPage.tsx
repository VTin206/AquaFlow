import { useState } from 'react'
import { Button, Card, DatePicker, Input, Select, Table, Tag, type TableColumnsType } from 'antd'
import type { Dayjs } from 'dayjs'
import { Download, Search } from 'lucide-react'
import { Page } from '../../shared/components/Page'
import { QueryError } from '../../shared/components/QueryError'
import { downloadCsv } from '../../shared/utils/csv'
import { tablePagination, tableScrollHeight } from '../../shared/utils/table'
import { OrderDetailsModal } from '../orders/components/OrderDetailsModal'
import { useOrders } from '../orders/useOrders'
import { localDay } from '../reports/reportService'
import { useActivity, type ActivityArea, type ActivityEntry } from './activityService'

const ALL = 'Tất cả'
const areaColors: Record<ActivityArea, string> = {
  'Đơn hàng': 'blue',
  'Thanh toán': 'green',
  'Kho hàng': 'purple',
  'Khách hàng': 'cyan',
  'Giao hàng': 'geekblue',
  'Nhà cung cấp': 'magenta',
  'Cài đặt': 'default',
}

export function ActivityPage() {
  const activityQuery = useActivity()
  const { data: orders = [] } = useOrders()
  const [area, setArea] = useState<string>(ALL)
  const [person, setPerson] = useState<string>(ALL)
  const [query, setQuery] = useState('')
  const [dates, setDates] = useState<[Dayjs, Dayjs] | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)

  const entries = activityQuery.data ?? []
  const people = [...new Set(entries.map((entry) => entry.by))].sort((a, b) => a.localeCompare(b, 'vi'))
  const keyword = query.trim().toLowerCase()
  const visible = entries.filter(
    (entry) =>
      (area === ALL || entry.area === area) &&
      (person === ALL || entry.by === person) &&
      (!dates || (localDay(entry.at) >= dates[0].format('YYYY-MM-DD') && localDay(entry.at) <= dates[1].format('YYYY-MM-DD'))) &&
      `${entry.target} ${entry.action} ${entry.by}`.toLowerCase().includes(keyword),
  )
  const openable = new Set(orders.map((order) => order.id))

  const columns: TableColumnsType<ActivityEntry> = [
    { title: 'Thời điểm', dataIndex: 'at', width: 170, render: (at: string) => new Date(at).toLocaleString('vi-VN') },
    { title: 'Người thực hiện', dataIndex: 'by', width: 200, ellipsis: true },
    { title: 'Khu vực', dataIndex: 'area', width: 130, render: (value: ActivityArea) => <Tag color={areaColors[value]}>{value}</Tag> },
    {
      title: 'Đối tượng',
      dataIndex: 'target',
      width: 120,
      render: (target: string) =>
        openable.has(target) ? (
          <Button type="link" size="small" onClick={() => setOrderId(target)}>
            {target}
          </Button>
        ) : (
          target
        ),
    },
    { title: 'Nội dung', dataIndex: 'action', ellipsis: { showTitle: true } },
  ]

  return (
    <Page
      title="Nhật ký hoạt động"
      description="Ai làm gì, lúc nào trên đơn hàng, tiền, kho và giao hàng. Nhật ký chỉ ghi thêm, không sửa hoặc xóa được."
      actions={
        <Button
          icon={<Download size={16} />}
          disabled={!visible.length}
          onClick={() =>
            downloadCsv('nhat-ky-hoat-dong.csv', [['Thời điểm', 'Người thực hiện', 'Khu vực', 'Đối tượng', 'Nội dung'], ...visible.map((entry) => [new Date(entry.at).toLocaleString('vi-VN'), entry.by, entry.area, entry.target, entry.action])])
          }
        >
          Xuất CSV
        </Button>
      }
    >
      <Card className="af-card" styles={{ body: { padding: 0 } }}>
        {activityQuery.isError ? (
          <QueryError error={activityQuery.error} onRetry={activityQuery.refetch} />
        ) : (
          <>
            <div className="af-toolbar">
              <div className="af-order-filters">
                <Select aria-label="Lọc khu vực" value={area} onChange={setArea} style={{ minWidth: 150 }} options={[ALL, ...Object.keys(areaColors)].map((value) => ({ value, label: value === ALL ? 'Mọi khu vực' : value }))} />
                <Select
                  aria-label="Lọc người thực hiện"
                  showSearch
                  value={person}
                  onChange={setPerson}
                  style={{ minWidth: 190 }}
                  options={[{ value: ALL, label: 'Mọi người' }, ...people.map((value) => ({ value, label: value }))]}
                />
                <DatePicker.RangePicker aria-label="Lọc theo ngày" format="DD/MM/YYYY" value={dates} onChange={(value) => setDates(value?.[0] && value[1] ? [value[0], value[1]] : null)} />
              </div>
              <Input
                allowClear
                prefix={<Search size={16} className="af-input-icon" />}
                placeholder="Tìm mã đơn, nội dung, người thực hiện..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="af-search"
              />
            </div>
            <Table<ActivityEntry>
              className="af-data-table"
              rowKey="id"
              size="middle"
              columns={columns}
              dataSource={visible}
              loading={activityQuery.isPending}
              pagination={{ ...tablePagination, defaultPageSize: 20 }}
              locale={{ emptyText: keyword || area !== ALL || person !== ALL || dates ? 'Không có hoạt động phù hợp bộ lọc.' : 'Chưa có hoạt động nào.' }}
              scroll={{ x: 900, y: tableScrollHeight }}
            />
          </>
        )}
      </Card>
      {orderId && <OrderDetailsModal orderId={orderId} onClose={() => setOrderId(null)} />}
    </Page>
  )
}
