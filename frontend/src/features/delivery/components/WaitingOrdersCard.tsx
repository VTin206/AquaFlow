import type { ReactNode } from 'react'
import { Button, Card, Empty, Table, Tag } from 'antd'
import { Truck } from 'lucide-react'
import { Money } from '@/shared/components/Money'
import { dueTone } from '@/shared/utils/money'

export type WaitingOrder = {
  id: string
  code: string
  customer: string
  address: string
  appointment?: string
  jugs: number
  /** null: đã thu một phần mà chưa biết số còn lại. */
  due: number | null
  redelivery: boolean
  orderedAt?: { label: string; full: string }
}

type WaitingOrdersCardProps = {
  orders: WaitingOrder[]
  loading: boolean
  selected: string[]
  onSelect: (ids: string[]) => void
  onCreate: () => void
  /** Thay bảng khi không tải được danh sách. */
  error?: ReactNode
}

/** Đơn chờ xếp chuyến: chọn đơn rồi tạo chuyến. Dùng chung cho bản dùng thử và tài khoản thật. */
export function WaitingOrdersCard({ orders, loading, selected, onSelect, onCreate, error }: WaitingOrdersCardProps) {
  const chosen = orders.filter((order) => selected.includes(order.id))
  return (
    <Card
      className="af-card"
      styles={{ body: { padding: 0 } }}
      title={
        <span className="af-panel-title">
          Đơn chờ xếp chuyến <Tag>{orders.length}</Tag>
        </span>
      }
      extra={
        <Button type="primary" icon={<Truck size={16} />} disabled={!chosen.length} onClick={onCreate}>
          {chosen.length ? `Tạo chuyến (${chosen.length} đơn)` : 'Chọn đơn để tạo chuyến'}
        </Button>
      }
    >
      {error ?? (
        <Table<WaitingOrder>
          className="af-data-table af-table-flush"
          size="middle"
          rowKey="id"
          loading={loading}
          dataSource={orders}
          pagination={false}
          scroll={{ x: 820, y: 320 }}
          rowSelection={{ selectedRowKeys: chosen.map((order) => order.id), onChange: (keys) => onSelect(keys as string[]) }}
          locale={{
            emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có đơn chờ giao. Đơn giao đang chuẩn bị sẽ hiện ở đây." />,
          }}
          columns={[
            {
              title: 'Đơn',
              dataIndex: 'code',
              width: 190,
              render: (code: string, order) => (
                <div className="af-cell-stack">
                  <span className="af-strong af-cell-truncate" title={code}>
                    {code}
                  </span>
                  {order.redelivery ? (
                    <small className="af-text-warning">Giao lại</small>
                  ) : (
                    order.orderedAt && <small title={order.orderedAt.full}>{order.orderedAt.label}</small>
                  )}
                </div>
              ),
            },
            {
              title: 'Khách / địa chỉ',
              key: 'customer',
              render: (_, order) => (
                <div className="af-cell-stack">
                  <span>{order.customer}</span>
                  <small className="af-cell-truncate" title={order.address}>
                    {order.address}
                  </small>
                </div>
              ),
            },
            {
              title: 'Hẹn giao',
              dataIndex: 'appointment',
              width: 140,
              render: (value?: string) =>
                value ? new Date(value).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '—',
            },
            { title: 'Bình', dataIndex: 'jugs', width: 80, align: 'right', render: (jugs: number) => jugs || '—' },
            {
              title: 'Cần thu',
              dataIndex: 'due',
              width: 130,
              align: 'right',
              render: (due: number | null) => (due === null ? 'Thu một phần' : <Money value={due} tone={dueTone(due)} />),
            },
          ]}
        />
      )}
    </Card>
  )
}
