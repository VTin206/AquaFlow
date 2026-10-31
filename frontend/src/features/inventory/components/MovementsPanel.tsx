import { useState } from 'react'
import { Empty, Segmented, Table, Tag, Typography } from 'antd'
import { CountLabel } from '@/shared/components/CountLabel'
import { tablePagination, tableScrollHeight } from '@/shared/utils/table'
import type { Order } from '@/features/orders/types'
import { useOrders } from '@/features/orders/useOrders'
import { isoToVnDate } from '../expiry'

type MovementType = 'DISPATCH' | 'RETURN'
type Movement = {
  key: string
  type: MovementType
  at: string
  by?: string
  orderId: string
  tripId?: string
  name: string
  unit: string
  lotCode?: string
  expiryDate?: string
  /** Âm khi xuất, dương khi nhập lại. */
  quantity: number
  damaged?: number
}

/** Suy biến động kho từ các lần xuất giao và kiểm hàng hoàn của đơn. */
const movementsOf = (orders: Order[]): Movement[] =>
  orders
    .flatMap((order) => [
      ...(order.dispatches ?? []).flatMap((dispatch, index) =>
        dispatch.lines.map((line, row) => ({
          key: `${order.id}-d${index}-${row}`,
          type: 'DISPATCH' as const,
          at: dispatch.at,
          by: dispatch.by,
          orderId: order.id,
          tripId: dispatch.tripId,
          name: line.name,
          unit: line.unit,
          lotCode: line.lotCode,
          expiryDate: line.expiryDate,
          quantity: -line.quantity,
        })),
      ),
      ...(order.returnInspections ?? []).flatMap((inspection, index) =>
        inspection.lines.map((line, row) => ({
          key: `${order.id}-r${index}-${row}`,
          type: 'RETURN' as const,
          at: inspection.at,
          by: inspection.by,
          orderId: order.id,
          name: line.name,
          unit: line.unit,
          lotCode: line.lotCode,
          expiryDate: line.expiryDate,
          quantity: line.sellable,
          damaged: line.damaged,
        })),
      ),
    ])
    .sort((a, b) => b.at.localeCompare(a.at))

export function MovementsPanel() {
  const ordersQuery = useOrders()
  const [type, setType] = useState<'all' | MovementType>('all')
  const movements = movementsOf(ordersQuery.data ?? [])
  const visible = type === 'all' ? movements : movements.filter((movement) => movement.type === type)
  const count = (value: MovementType) => movements.filter((movement) => movement.type === value).length

  return (
    <>
      <div className="af-toolbar">
        <Segmented<'all' | MovementType>
          value={type}
          onChange={setType}
          options={[
            { value: 'all', label: <CountLabel label="Tất cả" count={movements.length} /> },
            { value: 'DISPATCH', label: <CountLabel label="Xuất giao" count={count('DISPATCH')} /> },
            { value: 'RETURN', label: <CountLabel label="Nhập hàng hoàn" count={count('RETURN')} /> },
          ]}
        />
      </div>
      <Table<Movement>
        key={type}
        className="af-data-table af-table-flush"
        size="middle"
        rowKey="key"
        loading={ordersQuery.isPending}
        dataSource={visible}
        pagination={tablePagination}
        scroll={{ x: 900, y: tableScrollHeight }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có lần xuất giao hay nhập hàng hoàn." /> }}
        columns={[
          {
            title: 'Thời điểm',
            dataIndex: 'at',
            width: 150,
            render: (at: string) => (
              <div className="af-cell-stack">
                <span>{new Date(at).toLocaleTimeString('vi-VN')}</span>
                <small>{new Date(at).toLocaleDateString('vi-VN')}</small>
              </div>
            ),
          },
          {
            title: 'Loại',
            dataIndex: 'type',
            width: 140,
            render: (value: MovementType) => (value === 'DISPATCH' ? <Tag color="blue">Xuất giao</Tag> : <Tag color="green">Nhập hàng hoàn</Tag>),
          },
          { title: 'Sản phẩm', dataIndex: 'name', ellipsis: true },
          {
            title: 'Lô',
            key: 'lot',
            width: 140,
            render: (_, movement) => (movement.lotCode ? (
              <div className="af-cell-stack">
                <span>{movement.lotCode}</span>
                {movement.expiryDate && <small>HSD {isoToVnDate(movement.expiryDate)}</small>}
              </div>
            ) : <Typography.Text type="secondary">—</Typography.Text>),
          },
          {
            title: 'Số lượng',
            dataIndex: 'quantity',
            align: 'right',
            width: 130,
            render: (quantity: number, movement) => (
              <div className="af-cell-stack">
                <span className={quantity < 0 ? 'af-text-danger' : undefined}>{quantity > 0 ? `+${quantity}` : quantity} {movement.unit.toLowerCase()}</span>
                {movement.damaged ? <small>hỏng {movement.damaged}</small> : null}
              </div>
            ),
          },
          {
            title: 'Chứng từ',
            key: 'ref',
            width: 160,
            render: (_, movement) => (
              <div className="af-cell-stack">
                <span>{movement.orderId}</span>
                <small>{[movement.tripId && `chuyến ${movement.tripId}`, movement.by].filter(Boolean).join(' · ')}</small>
              </div>
            ),
          },
        ]}
      />
    </>
  )
}
