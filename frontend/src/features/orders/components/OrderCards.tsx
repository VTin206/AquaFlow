import { useState } from 'react'
import { Button, Select, Space } from 'antd'
import { Eye } from 'lucide-react'
import { MobileRecordList } from '../../../shared/components/MobileRecordList'
import { Money } from '../../../shared/components/Money'
import { amountDue, paymentLabel, type Order } from '../types'
import { nextActionLabel } from '../orderStatus'
import { AdvanceStatusButton } from './AdvanceStatusButton'
import { LateTag } from './LateTag'
import { OrderStatusTag } from './OrderStatusTag'

type OrderCardsProps = {
  orders: Order[]
  loading?: boolean
  compact: boolean
  emptyText: string
  onDetails: (id: string) => void
}
type Sort = 'default' | 'total' | 'due'

export function OrderCards({ orders, loading, compact, emptyText, onDetails }: OrderCardsProps) {
  const [sort, setSort] = useState<Sort>('default')
  const sorted = [...orders].sort((a, b) => sort === 'total' ? b.total - a.total
    : sort === 'due' ? (b.status === 'Đã hủy' ? 0 : amountDue(b)) - (a.status === 'Đã hủy' ? 0 : amountDue(a)) : 0)

  return (
    <MobileRecordList
      key={sort}
      items={sorted}
      rowKey={(order) => order.id}
      loading={loading}
      emptyText={emptyText}
      label="Danh sách đơn hàng"
      paginate={!compact}
      controls={!compact && (
        <Select<Sort> aria-label="Sắp xếp đơn hàng" value={sort} onChange={setSort} options={[
          { value: 'default', label: 'Thứ tự mặc định' },
          { value: 'total', label: 'Tổng tiền: cao trước' },
          { value: 'due', label: 'Còn phải thu: cao trước' },
        ]} />
      )}
      renderItem={(order) => (
        <article className="af-record" aria-label={`Đơn ${order.id}`}>
          <div className="af-record-heading"><strong>{order.id}</strong><span>{order.time}</span></div>
          <h3>{order.customer}</h3>
          <p className="af-record-meta">
            {order.method}
            {order.phone && <a href={`tel:${order.phone.replace(/[\s().-]/g, '')}`}>{order.phone}</a>}
          </p>
          <Space size={[4, 4]} wrap><OrderStatusTag status={order.status} method={order.method} /><LateTag order={order} /></Space>
          <dl className="af-record-facts">
            <dt>Tổng tiền</dt><dd><Money value={order.total} /></dd>
            {order.status !== 'Đã hủy' && <><dt>Còn phải thu</dt><dd><Money value={amountDue(order)} tone={amountDue(order) > 0 ? 'due' : 'paid'} /></dd></>}
          </dl>
          <p className="af-record-meta">{paymentLabel(order)}</p>
          <div className="af-record-actions">
            <Button icon={<Eye size={16} />} onClick={() => onDetails(order.id)} aria-label={`Chi tiết đơn ${order.id}`}>Chi tiết</Button>
            {!compact && nextActionLabel(order) && <AdvanceStatusButton order={order} size="middle" />}
          </div>
        </article>
      )}
    />
  )
}
