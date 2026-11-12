import { useState } from 'react'
import { Button, Grid, Space, Table, type TableColumnsType } from 'antd'
import { ViewButton } from '@/shared/components/ViewButton'
import { Money } from '@/shared/components/Money'
import { serverTablePagination, tablePagination, tableScrollHeight, type ServerPagination } from '@/shared/utils/table'
import { useColumnSort } from '@/shared/components/sortableColumn'
import { amountDue, compareDeliveryDue, compareOrderPriority, deliveryTimingOf, type Order } from '../types'
import { LateTag } from './LateTag'
import { OrderStatusTag } from './OrderStatusTag'
import { OrderCards } from './OrderCards'
import { OrderBulkActions } from './OrderBulkActions'
import { OrderDetails } from './OrderDetails'
import { OrderNextAction } from './OrderNextAction'

type OrdersTableProps = {
  orders: Order[]
  loading?: boolean
  /** Bản rút gọn cho Dashboard, kèm nút mở chi tiết. */
  compact?: boolean
  emptyText?: string
  /** Đổi bộ lọc chỉ đặt lại phân trang, giữ lựa chọn sắp xếp. */
  filterKey?: string
  /**
   * BE đã phân trang (lịch sử đơn, mới nhất trước): bảng chỉ hiện trang hiện tại và tắt sắp xếp theo cột,
   * vì sắp xếp trong một trang dễ bị hiểu nhầm là sắp xếp toàn bộ.
   */
  server?: ServerPagination
}

export function OrdersTable({
  orders,
  loading,
  compact = false,
  emptyText = 'Chưa có đơn hàng nào.',
  filterKey,
  server,
}: OrdersTableProps) {
  const screens = Grid.useBreakpoint()
  // Chưa có phiếu thu thì không tính "còn phải thu", dùng trạng thái thanh toán của BE.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Tích chọn nhiều đơn (chỉ bảng đầy đủ); chỉ tính các đơn còn hiện theo bộ lọc.
  const [checkedIds, setCheckedIds] = useState<string[]>([])
  const checked = compact ? [] : orders.filter((order) => checkedIds.includes(order.id))
  const [pageSize, setPageSize] = useState(tablePagination.defaultPageSize ?? 10)
  const sortable = !compact && !server
  // Mặc định sắp theo mức ưu tiên xử lý (gấp nhất lên đầu); bấm tiêu đề cột để sắp theo cột đó.
  // Danh sách phân trang ở BE đã được BE sắp theo cùng thứ tự.
  const sort = useColumnSort<Order>(null)
  const rows = sortable ? [...orders].sort((a, b) => compareOrderPriority(a, b)) : orders
  // Mã của BE (AF- + 20 ký tự) dài hơn mã mẫu nhiều, nên cột rộng theo mã dài nhất để không bị cắt.
  const longestCode = Math.max(0, ...orders.map((order) => (order.code ?? order.id).length))
  const codeWidth = Math.max(compact ? 110 : 150, longestCode * 9 + (compact ? 24 : 64))
  // Độ rộng tối thiểu của bảng = tổng các cột, để không tự giãn rồi che cột cố định bên phải.
  const tableMinWidth = codeWidth + (compact ? 180 + 150 + 170 + 80 : 44 + 220 + 170 + 160 + 170 + 112)
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
          <span className="af-cell-truncate" title={order.customer}>
            {order.customer}
          </span>
          <small className="af-cell-truncate" title={`${order.phone || 'Khách tại quầy'} · ${order.method}`}>
            {order.phone || 'Khách tại quầy'} · {order.method}
          </small>
        </div>
      ),
    },
    ...(compact
      ? []
      : [
          {
            ...(sortable ? sort.column('Hẹn giao', 'due', 'time') : { title: 'Hẹn giao', key: 'due' }),
            dataIndex: 'appointment',
            width: 170,
            sorter: sortable ? compareDeliveryDue : undefined,
            render: (_: string, order: Order) => {
              const { main, sub } = deliveryTimingOf(order)
              return (
                <div className="af-cell-stack af-timing-cell">
                  <span className={`af-timing is-${main.tone}`} title={main.title}>
                    {main.label}
                  </span>
                  <small title={sub.title}>{sub.label}</small>
                </div>
              )
            },
          },
        ]),
    {
      title: 'Tổng tiền',
      ...(sortable && sort.column('Tổng tiền', 'total', 'number')),
      dataIndex: 'total',
      align: 'right',
      width: compact ? 150 : 160,
      sorter: sortable ? (a, b) => a.total - b.total : undefined,
      // Gộp thanh toán vào đây: dòng dưới là số còn phải thu, hoặc trạng thái thanh toán của BE khi chưa có phiếu thu.
      render: (total: number, order) => (
        <div className="af-cell-stack af-money-stack">
          <Money value={total} />
          {!compact && order.status !== 'Đã hủy' && (
            <small>
              {amountDue(order) > 0 ? (
                <Money value={amountDue(order)} tone="due" prefix="Còn " />
              ) : (
                <span className="af-money is-paid">Đã thu đủ</span>
              )}
            </small>
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
          <ViewButton subject={`đơn ${order.code ?? order.id}`} onClick={() => setSelectedId(order.id)} />
          {!compact && <OrderNextAction order={order} dense />}
        </Space>
      ),
    },
  ]

  return (
    <>
      {screens.md === false ? (
        <OrderCards
          orders={rows}
          loading={loading}
          compact={compact}
          emptyText={emptyText}
          onDetails={setSelectedId}
          filterKey={filterKey}
          server={server}
        />
      ) : (
        <>
          {!compact && <OrderBulkActions orders={checked} onSelect={setCheckedIds} />}
          <Table<Order>
            key={filterKey}
            className="af-data-table af-table-flush"
            rowKey="id"
            columns={columns}
            dataSource={rows}
            loading={loading}
            size="middle"
            pagination={
              compact
                ? false
                : server
                  ? serverTablePagination(server)
                  : { ...tablePagination, pageSize, onShowSizeChange: (_, size) => setPageSize(size) }
            }
            locale={{ emptyText }}
            scroll={{ x: tableMinWidth, ...(!compact && { y: tableScrollHeight }) }}
            rowSelection={
              compact
                ? undefined
                : {
                    selectedRowKeys: checked.map((order) => order.id),
                    onChange: (keys) => setCheckedIds(keys.map(String)),
                    fixed: 'left',
                    columnWidth: 44,
                  }
            }
          />
        </>
      )}
      {selectedId && <OrderDetails id={selectedId} onClose={() => setSelectedId(null)} />}
    </>
  )
}
