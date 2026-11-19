import { useState, type ReactNode } from 'react'
import { Button, Card, Empty, Select, Table, Tag, Typography } from 'antd'
import { Truck } from 'lucide-react'
import { Money } from '@/shared/components/Money'
import { dueTone } from '@/shared/utils/money'
import { formatDeliveryWindowShort } from '@/shared/utils/deliveryWindow'

export type WaitingOrder = {
  id: string
  code: string
  customer: string
  address: string
  /** Phường/xã giao, để lọc và gom các đơn gần nhau vào một chuyến. */
  area?: string
  appointment?: string
  /** Cuối khung giờ khách chọn. */
  appointmentUntil?: string
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

const NO_AREA = 'Chưa rõ phường'
const areaOf = (order: WaitingOrder) => order.area ?? NO_AREA

/** Đơn chờ xếp chuyến: lọc theo phường, chọn đơn rồi tạo chuyến. */
export function WaitingOrdersCard({ orders, loading, selected, onSelect, onCreate, error }: WaitingOrdersCardProps) {
  const [area, setArea] = useState<string>()
  // Mỗi phường kèm số đơn và số bình để biết gom bao nhiêu đơn thì đủ một chuyến.
  const areas = [...new Set(orders.map(areaOf))]
    .sort((a, b) => (a === NO_AREA ? 1 : b === NO_AREA ? -1 : a.localeCompare(b, 'vi')))
    .map((name) => {
      const inArea = orders.filter((order) => areaOf(order) === name)
      return { name, count: inArea.length, jugs: inArea.reduce((sum, order) => sum + order.jugs, 0) }
    })
  // Phường đang lọc không còn đơn (vừa xếp chuyến hết) thì quay về tất cả.
  const areaFilter = area && areas.some((item) => item.name === area) ? area : undefined
  // Đơn cùng phường nằm cạnh nhau; trong một phường giữ thứ tự cũ.
  const rank = new Map(areas.map((item, index) => [item.name, index]))
  const shown = orders
    .filter((order) => !areaFilter || areaOf(order) === areaFilter)
    .map((order, index) => ({ order, index }))
    .sort((a, b) => rank.get(areaOf(a.order))! - rank.get(areaOf(b.order))! || a.index - b.index)
    .map(({ order }) => order)
  const chosen = orders.filter((order) => selected.includes(order.id))
  const chosenJugs = chosen.reduce((sum, order) => sum + order.jugs, 0)
  const chosenIds = chosen.map((order) => order.id)
  // Bấm chỗ nào trên dòng cũng chọn/bỏ chọn đơn; ô vuông tự xử lý nên bỏ qua để không đổi hai lần.
  const toggleRow = (id: string, target: EventTarget) => {
    if (target instanceof Element && target.closest('.ant-table-selection-column, button, a, input, label')) return
    onSelect(chosenIds.includes(id) ? chosenIds.filter((item) => item !== id) : [...chosenIds, id])
  }
  // Không có đơn chờ thì thu khung về một dòng tiêu đề, nhường chỗ cho danh sách chuyến bên dưới.
  const idle = !orders.length && !loading && !error
  return (
    <Card
      className="af-card af-waiting-card"
      styles={{ body: { padding: 0, display: idle ? 'none' : undefined }, header: idle ? { borderBottom: 0 } : undefined }}
      title={
        <span className="af-panel-title">
          Đơn chờ xếp chuyến <Tag>{orders.length}</Tag>
          {areas.length > 1 && (
            <Select
              size="small"
              allowClear
              showSearch
              optionFilterProp="label"
              aria-label="Lọc theo phường"
              placeholder="Tất cả phường"
              value={areaFilter}
              onChange={setArea}
              popupMatchSelectWidth={false}
              style={{ minWidth: 180 }}
              options={areas.map((item) => ({
                value: item.name,
                label: `${item.name} · ${item.count} đơn${item.jugs ? ` · ${item.jugs} bình` : ''}`,
              }))}
            />
          )}
        </span>
      }
      extra={
        // Chưa chọn đơn: chỉ gợi ý bằng chữ, không để nút bị khóa xám lẫn màu với chữ trên nút.
        chosen.length ? (
          <Button type="primary" icon={<Truck size={16} />} onClick={onCreate}>
            {`Tạo chuyến (${chosen.length} đơn${chosenJugs ? ` · ${chosenJugs} bình` : ''})`}
          </Button>
        ) : (
          <Typography.Text type="secondary">{idle ? 'Không có đơn chờ giao' : 'Chọn đơn để tạo chuyến'}</Typography.Text>
        )
      }
    >
      {error ?? (
        <Table<WaitingOrder>
          className="af-data-table af-table-flush"
          size="middle"
          rowKey="id"
          loading={loading}
          dataSource={shown}
          pagination={false}
          scroll={{ x: 960, y: 320 }}
          // Giữ đơn đã chọn ở phường khác khi đổi bộ lọc, để gom đơn nhiều phường vào một chuyến.
          rowSelection={{ selectedRowKeys: chosenIds, preserveSelectedRowKeys: true, onChange: (keys) => onSelect(keys as string[]) }}
          rowClassName="af-row-clickable"
          onRow={(order) => ({ onClick: (event) => toggleRow(order.id, event.target) })}
          locale={{
            emptyText: (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có đơn chờ giao. Đơn giao đang chuẩn bị sẽ hiện ở đây." />
            ),
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
              title: 'Phường',
              key: 'area',
              width: 180,
              // Một dòng; tên dài thì cắt và hiện đủ khi rê chuột.
              ellipsis: { showTitle: true },
              render: (_, order) => order.area ?? <Typography.Text type="secondary">—</Typography.Text>,
            },
            {
              title: 'Hẹn giao',
              dataIndex: 'appointment',
              width: 140,
              render: (value: string | undefined, row: WaitingOrder) =>
                value ? formatDeliveryWindowShort(value, row.appointmentUntil) : '—',
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
