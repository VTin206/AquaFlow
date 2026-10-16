import { useState } from 'react'
import { Button, Card, Input, Segmented, Table, Tag, Typography, type TableColumnsType } from 'antd'
import { Search } from 'lucide-react'
import { ErrorState } from '../components/StateViews'
import { useOrders } from '../hooks/useOrders'
import type { Order, OrderStatus } from '../types'
import { currency } from '../utils/format'

const ALL = 'Tất cả'
const statuses: OrderStatus[] = ['Chờ xác nhận', 'Đang chuẩn bị', 'Đang giao', 'Đã hoàn tất']

const statusColor: Record<OrderStatus, string> = {
  'Chờ xác nhận': 'gold',
  'Đang chuẩn bị': 'blue',
  'Đang giao': 'cyan',
  'Đã hoàn tất': 'green',
}

// Nút hành động ghi rõ bước tiếp theo, thay cho nút "…" khó hiểu.
const nextAction: Partial<Record<OrderStatus, string>> = {
  'Chờ xác nhận': 'Xác nhận',
  'Đang chuẩn bị': 'Bắt đầu giao',
  'Đang giao': 'Hoàn tất',
}

export function OrdersPage({ onChangeStatus }: { onChangeStatus: (id: string) => void }) {
  const ordersQuery = useOrders()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<string>(ALL)

  if (ordersQuery.isError) {
    return (
      <Card>
        <ErrorState message={ordersQuery.error.message} onRetry={() => ordersQuery.refetch()} />
      </Card>
    )
  }

  const allOrders = ordersQuery.data ?? []
  const countOf = (value: string) => (value === ALL ? allOrders.length : allOrders.filter((order) => order.status === value).length)
  const keyword = query.trim().toLowerCase()
  const visible = allOrders.filter(
    (order) =>
      (status === ALL || order.status === status) &&
      `${order.id} ${order.customer} ${order.phone} ${order.items}`.toLowerCase().includes(keyword),
  )

  const columns: TableColumnsType<Order> = [
    { title: 'Mã đơn', dataIndex: 'id', width: 110, render: (id: string) => <Typography.Text strong>{id}</Typography.Text> },
    {
      title: 'Khách hàng',
      dataIndex: 'customer',
      render: (_, order) => (
        <div className="af-cell-stack">
          <span>{order.customer}</span>
          <small>{order.phone}</small>
        </div>
      ),
    },
    { title: 'Sản phẩm', dataIndex: 'items', ellipsis: true },
    { title: 'Giờ đặt', dataIndex: 'time', width: 120, sorter: (a, b) => a.time.localeCompare(b.time) },
    {
      title: 'Tổng tiền',
      dataIndex: 'total',
      align: 'right',
      width: 140,
      sorter: (a, b) => a.total - b.total,
      render: (total: number) => <span className="af-money">{currency(total)}</span>,
    },
    { title: 'Trạng thái', dataIndex: 'status', width: 150, render: (value: OrderStatus) => <Tag color={statusColor[value]}>{value}</Tag> },
    {
      title: 'Thao tác',
      key: 'action',
      width: 140,
      render: (_, order) =>
        nextAction[order.status] ? (
          <Button size="small" type={order.status === 'Chờ xác nhận' ? 'primary' : 'default'} onClick={() => onChangeStatus(order.id)}>
            {nextAction[order.status]}
          </Button>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
  ]

  return (
    <Card className="af-card" styles={{ body: { padding: 0 } }}>
      <div className="af-toolbar">
        <Segmented
          value={status}
          onChange={(value) => setStatus(String(value))}
          options={[ALL, ...statuses].map((value) => ({ value, label: `${value} (${countOf(value)})` }))}
        />
        <Input
          allowClear
          prefix={<Search size={16} color="#667085" />}
          placeholder="Tìm mã đơn, tên khách, số điện thoại..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="af-search"
        />
      </div>
      <Table<Order>
        rowKey="id"
        columns={columns}
        dataSource={visible}
        loading={ordersQuery.isPending}
        pagination={{ pageSize: 10, hideOnSinglePage: true, showTotal: (total) => `${total} đơn hàng` }}
        locale={{ emptyText: keyword || status !== ALL ? 'Không có đơn phù hợp. Thử đổi từ khóa hoặc trạng thái.' : 'Chưa có đơn hàng nào.' }}
        scroll={{ x: 900 }}
      />
    </Card>
  )
}
