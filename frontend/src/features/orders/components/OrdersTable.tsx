import { Table, Typography, type TableColumnsType } from 'antd'
import { currency } from '../../../shared/utils/format'
import type { Order } from '../types'
import { AdvanceStatusButton } from './AdvanceStatusButton'
import { OrderStatusTag } from './OrderStatusTag'

type OrdersTableProps = {
  orders: Order[]
  loading?: boolean
  /** Bản rút gọn cho Dashboard: ẩn cột sản phẩm, không phân trang. */
  compact?: boolean
  emptyText?: string
}

export function OrdersTable({ orders, loading, compact = false, emptyText = 'Chưa có đơn hàng nào.' }: OrdersTableProps) {
  const columns: TableColumnsType<Order> = [
    {
      title: 'Mã đơn',
      dataIndex: 'id',
      width: 150,
      render: (id: string, order) => (
        <span className="af-order-id">
          <Typography.Text strong>{id}</Typography.Text>
          {order.status === 'Chờ xác nhận' && <span className="af-new-tag">Mới</span>}
        </span>
      ),
    },
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
    ...(compact ? [] : [{ title: 'Sản phẩm', dataIndex: 'items', ellipsis: true } as const]),
    { title: 'Giờ đặt', dataIndex: 'time', width: 110, sorter: compact ? undefined : (a, b) => a.time.localeCompare(b.time) },
    {
      title: 'Tổng tiền',
      dataIndex: 'total',
      align: 'right',
      width: 140,
      sorter: compact ? undefined : (a, b) => a.total - b.total,
      render: (total: number) => <span className="af-money">{currency(total)}</span>,
    },
    { title: 'Trạng thái', dataIndex: 'status', width: 150, render: (_, order) => <OrderStatusTag status={order.status} /> },
    { title: 'Thao tác', key: 'action', width: 140, render: (_, order) => <AdvanceStatusButton order={order} /> },
  ]

  return (
    <Table<Order>
      rowKey="id"
      columns={columns}
      dataSource={orders}
      loading={loading}
      size={compact ? 'middle' : 'large'}
      pagination={compact ? false : { pageSize: 10, hideOnSinglePage: true, showTotal: (total) => `${total} đơn hàng` }}
      locale={{ emptyText }}
      scroll={{ x: compact ? 720 : 960 }}
    />
  )
}
