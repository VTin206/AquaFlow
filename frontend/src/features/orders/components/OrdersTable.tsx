import { useState } from 'react'
import { Button, Grid, Space, Table, Tooltip, type TableColumnsType } from 'antd'
import { Eye } from 'lucide-react'
import { Money } from '../../../shared/components/Money'
import { tablePagination, tableScrollHeight } from '../../../shared/utils/table'
import { useColumnSort } from '../../../shared/components/sortableColumn'
import { useFeature, useIsDemo } from '../../../shared/features'
import { LiveOrderDetails } from '../../live/LiveOrderDetails'
import { amountDue, appointmentOf, createdAtOf, orderedAtOf, paymentLabel, type Order } from '../types'
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
  /** Đổi bộ lọc chỉ đặt lại phân trang, giữ lựa chọn sắp xếp. */
  filterKey?: string
}

export function OrdersTable({ orders, loading, compact = false, emptyText = 'Chưa có đơn hàng nào.', filterKey }: OrdersTableProps) {
  const screens = Grid.useBreakpoint()
  const demo = useIsDemo()
  // Tài khoản thật: BE chưa có phiếu thu nên không tính "còn phải thu"; thao tác đơn nằm trong chi tiết đơn.
  const showPayments = useFeature('orderPayments')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pageSize, setPageSize] = useState(tablePagination.defaultPageSize ?? 10)
  const sort = useColumnSort<Order>()
  // Mã của BE (AF- + 20 ký tự) dài hơn mã mẫu nhiều, nên cột rộng theo mã dài nhất để không bị cắt.
  const longestCode = Math.max(0, ...orders.map((order) => (order.code ?? order.id).length))
  const codeWidth = Math.max(compact ? 110 : 150, longestCode * 9 + (compact ? 24 : 64))
  // Độ rộng tối thiểu của bảng = tổng các cột, để không tự giãn rồi che cột cố định bên phải.
  const tableMinWidth = codeWidth + (compact ? 180 + 150 + 170 + 80 : 220 + 130 + 160 + 170 + 112)
  const columns: TableColumnsType<Order> = [
    {
      title: 'Mã đơn',
      dataIndex: 'id',
      width: codeWidth,
      render: (id: string, order) => (
        <span className="af-order-id">
          <Button type="link" size="small" onClick={() => setSelectedId(id)} aria-label={`Xem đơn ${order.code ?? id}`}>
            {order.code ?? id}
          </Button>
          {!compact && order.status === 'Chờ xác nhận' && <span className="af-new-tag">Mới</span>}
        </span>
      ),
    },
    {
      title: 'Khách hàng',
      dataIndex: 'customer',
      // Không đặt độ rộng: cột tên nhận phần dư khi màn hình rộng, các cột số giữ vừa nội dung.
      minWidth: compact ? 180 : 220,
      render: (_, order) => (
        <div className="af-cell-stack">
          <span className="af-cell-truncate" title={order.customer}>{order.customer}</span>
          <small className="af-cell-truncate" title={`${order.phone || 'Khách tại quầy'} · ${order.method}`}>
            {order.phone || 'Khách tại quầy'} · {order.method}
          </small>
        </div>
      ),
    },
    ...(compact ? [] : [{ ...sort.column('Đặt lúc', 'time', 'time'), dataIndex: 'time', width: 130, sorter: (a: Order, b: Order) => (createdAtOf(a) ?? a.time).localeCompare(createdAtOf(b) ?? b.time), render: (_: string, order: Order) => {
      const at = orderedAtOf(order)
      const appointment = appointmentOf(order)
      return (
        <div className="af-cell-stack">
          <span className="af-ordered-at" title={`Đặt lúc ${at.full}`}>{at.label}</span>
          {appointment && <small className={`af-appointment is-${appointment.tone}`} title={`Hẹn giao ${appointment.full}`}>{appointment.label}</small>}
        </div>
      )
    } }]),
    {
      title: 'Tổng tiền',
      ...(!compact && sort.column('Tổng tiền', 'total', 'number')),
      dataIndex: 'total',
      align: 'right',
      width: compact ? 150 : 160,
      sorter: compact ? undefined : (a, b) => a.total - b.total,
      // Gộp thanh toán vào đây: dòng dưới là số còn phải thu, hoặc trạng thái thanh toán của BE khi chưa có phiếu thu.
      render: (total: number, order) => (
        <div className="af-cell-stack af-money-stack">
          <Money value={total} />
          {!compact && order.status !== 'Đã hủy' && (
            <small>{!showPayments ? <span className={paymentLabel(order) === 'Đã thanh toán' ? 'af-money is-paid' : 'af-money is-due'}>{paymentLabel(order)}</span> : amountDue(order) > 0 ? <Money value={amountDue(order)} tone="due" prefix="Còn " /> : <span className="af-money is-paid">Đã thu đủ</span>}</small>
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
    {
      title: 'Thao tác',
      key: 'action',
      width: compact ? 80 : 112,
      fixed: 'right',
      render: (_, order) => (
        <Space size={6}>
          <Tooltip title="Xem chi tiết">
            <Button size="small" icon={<Eye size={15} />} onClick={() => setSelectedId(order.id)} aria-label={`Chi tiết đơn ${order.code ?? order.id}`} />
          </Tooltip>
          {!compact && demo && <AdvanceStatusButton order={order} menu />}
        </Space>
      ),
    },
  ]

  return (
    <>
      {screens.md === false ? (
        <OrderCards orders={orders} loading={loading} compact={compact} emptyText={emptyText} onDetails={setSelectedId} filterKey={filterKey} />
      ) : <Table<Order>
        key={filterKey}
        className="af-data-table af-table-flush"
        rowKey="id"
        columns={columns}
        dataSource={orders}
        loading={loading}
        size="middle"
        pagination={compact ? false : { ...tablePagination, pageSize, onShowSizeChange: (_, size) => setPageSize(size) }}
        locale={{ emptyText }}
        scroll={{ x: tableMinWidth, ...(!compact && { y: tableScrollHeight }) }}
      />}
      {selectedId && (demo
        ? <OrderDetailsModal key={selectedId} orderId={selectedId} onClose={() => setSelectedId(null)} />
        : <LiveOrderDetails key={selectedId} id={Number(selectedId)} onClose={() => setSelectedId(null)} />)}
    </>
  )
}
