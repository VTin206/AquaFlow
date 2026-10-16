import { useState } from 'react'
import { Button, Space, Table, type TableColumnsType } from 'antd'
import { Eye } from 'lucide-react'
import { currency } from '../../../shared/utils/format'
import { tablePagination, tableScrollHeight } from '../../../shared/utils/table'
import { amountDue, paymentLabel, type Order } from '../types'
import { AdvanceStatusButton } from './AdvanceStatusButton'
import { OrderStatusTag } from './OrderStatusTag'
import { OrderDetailsModal } from './OrderDetailsModal'

type OrdersTableProps = {
  orders: Order[]
  loading?: boolean
  /** Bản rút gọn cho Dashboard, kèm nút mở chi tiết. */
  compact?: boolean
  emptyText?: string
}

export function OrdersTable({ orders, loading, compact = false, emptyText = 'Chưa có đơn hàng nào.' }: OrdersTableProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const columns: TableColumnsType<Order> = [
    {
      title: 'Mã đơn',
      dataIndex: 'id',
      width: compact ? 110 : 150,
      render: (id: string, order) => (
        <span className="af-order-id">
          <Button type="link" size="small" onClick={() => setSelectedId(id)} aria-label={`Xem đơn ${id}`}>
            {id}
          </Button>
          {!compact && order.status === 'Chờ xác nhận' && <span className="af-new-tag">Mới</span>}
        </span>
      ),
    },
    {
      title: 'Khách hàng',
      dataIndex: 'customer',
      width: compact ? 180 : 220,
      render: (_, order) => (
        <div className="af-cell-stack">
          <span className="af-cell-truncate" title={order.customer}>{order.customer}</span>
          <small className="af-cell-truncate" title={`${order.phone || 'Khách tại quầy'} · ${order.method}`}>
            {order.phone || 'Khách tại quầy'} · {order.method}
          </small>
        </div>
      ),
    },
    ...(compact ? [] : [{ title: 'Giờ đặt', dataIndex: 'time', width: 110, sorter: (a: Order, b: Order) => a.time.localeCompare(b.time) }]),
    {
      title: 'Tổng tiền',
      dataIndex: 'total',
      align: 'right',
      width: 140,
      sorter: compact ? undefined : (a, b) => a.total - b.total,
      render: (total: number) => <span className="af-money">{currency(total)}</span>,
    },
    { title: 'Xử lý đơn', dataIndex: 'status', width: 170, render: (_, order) => <OrderStatusTag status={order.status} method={order.method} /> },
    ...(compact
      ? []
      : [
          {
            title: 'Thanh toán',
            key: 'payment',
            width: 185,
            render: (_: unknown, order: Order) => (
              <div className="af-cell-stack">
                <span>{paymentLabel(order)}</span>
                {order.status !== 'Đã hủy' && <small>Còn {currency(amountDue(order))}</small>}
              </div>
            ),
          },
        ]),
    {
      title: 'Thao tác',
      key: 'action',
      width: compact ? 120 : 160,
      fixed: 'right',
      render: (_, order) => (
        <Space size={6}>
          <Button size="small" icon={<Eye size={15} />} onClick={() => setSelectedId(order.id)} aria-label={`Chi tiết đơn ${order.id}`}>
            Chi tiết
          </Button>
          {!compact && <AdvanceStatusButton order={order} menu />}
        </Space>
      ),
    },
  ]

  return (
    <>
      <Table<Order>
        className="af-data-table"
        rowKey="id"
        columns={columns}
        dataSource={orders}
        loading={loading}
        size="middle"
        pagination={compact ? false : tablePagination}
        locale={{ emptyText }}
        scroll={{ x: compact ? 720 : 1220, ...(!compact && { y: tableScrollHeight }) }}
      />
      {selectedId && <OrderDetailsModal key={selectedId} orderId={selectedId} onClose={() => setSelectedId(null)} />}
    </>
  )
}
