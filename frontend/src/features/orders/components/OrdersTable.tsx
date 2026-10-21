import { useState } from 'react'
import { Button, Grid, Space, Table, Tooltip, type TableColumnsType } from 'antd'
import { Eye } from 'lucide-react'
import { Money } from '../../../shared/components/Money'
import { tablePagination, tableScrollHeight } from '../../../shared/utils/table'
import { useColumnSort } from '../../../shared/components/sortableColumn'
import { amountDue, paidAmount, paymentLabel, type Order } from '../types'
import { AdvanceStatusButton } from './AdvanceStatusButton'
import { LateTag } from './LateTag'
import { OrderStatusTag } from './OrderStatusTag'
import { OrderDetailsModal } from './OrderDetailsModal'
import { OrderCards } from './OrderCards'

type OrdersTableProps = {
  orders: Order[]
  loading?: boolean
  /** Bản rút gọn cho Dashboard, kèm nút mở chi tiết. */
  compact?: boolean
  emptyText?: string
}

export function OrdersTable({ orders, loading, compact = false, emptyText = 'Chưa có đơn hàng nào.' }: OrdersTableProps) {
  const screens = Grid.useBreakpoint()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const sort = useColumnSort<Order>()
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
    ...(compact ? [] : [{ ...sort.column('Giờ đặt', 'time', 'time'), dataIndex: 'time', width: 130, sorter: (a: Order, b: Order) => a.time.localeCompare(b.time) }]),
    {
      title: 'Tổng tiền',
      ...(!compact && sort.column('Tổng tiền', 'total', 'number')),
      dataIndex: 'total',
      align: 'right',
      width: 140,
      sorter: compact ? undefined : (a, b) => a.total - b.total,
      render: (total: number, order) => (
        <div className="af-cell-stack af-money-stack">
          <Money value={total} />
          {!compact && order.status !== 'Đã hủy' && (
            <small>{amountDue(order) > 0 ? <Money value={amountDue(order)} tone="due" prefix="Còn " /> : <span className="af-money is-paid">Đã thu đủ</span>}</small>
          )}
        </div>
      ),
    },
    {
      title: 'Xử lý đơn',
      dataIndex: 'status',
      width: 170,
      render: (_, order) => (
        <Space size={4} wrap>
          <OrderStatusTag status={order.status} method={order.method} />
          <LateTag order={order} />
        </Space>
      ),
    },
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
                {order.payments.length > 0 && <small>Đã thu <Money value={paidAmount(order)} tone="paid" /></small>}
              </div>
            ),
          },
        ]),
    {
      title: 'Thao tác',
      key: 'action',
      width: compact ? 80 : 100,
      fixed: 'right',
      render: (_, order) => (
        <Space size={6}>
          <Tooltip title="Xem chi tiết">
            <Button size="small" icon={<Eye size={15} />} onClick={() => setSelectedId(order.id)} aria-label={`Chi tiết đơn ${order.id}`} />
          </Tooltip>
          {!compact && <AdvanceStatusButton order={order} menu />}
        </Space>
      ),
    },
  ]

  return (
    <>
      {screens.md === false ? (
        <OrderCards orders={orders} loading={loading} compact={compact} emptyText={emptyText} onDetails={setSelectedId} />
      ) : <Table<Order>
        className="af-data-table"
        rowKey="id"
        columns={columns}
        dataSource={orders}
        loading={loading}
        size="middle"
        pagination={compact ? false : tablePagination}
        locale={{ emptyText }}
        scroll={{ x: compact ? 720 : 1220, ...(!compact && { y: tableScrollHeight }) }}
      />}
      {selectedId && <OrderDetailsModal key={selectedId} orderId={selectedId} onClose={() => setSelectedId(null)} />}
    </>
  )
}
