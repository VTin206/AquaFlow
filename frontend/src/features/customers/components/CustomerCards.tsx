import { useState } from 'react'
import { Button, Select, Tooltip } from 'antd'
import { Eye, Plus } from 'lucide-react'
import { MobileRecordList } from '@/shared/components/MobileRecordList'
import { Money } from '@/shared/components/Money'
import { useFeature } from '@/shared/features'
import { Unsupported } from '@/shared/components/Unsupported'
import { customerCode, type Customer } from '../types'

type CustomerCardsProps = {
  customers: Customer[]
  loading: boolean
  emptyText: string
  onProfile: (id: string) => void
  onCreateOrder: (customer: Customer) => void
}
type Sort = 'orders' | 'name' | 'debt' | 'bottles'

export function CustomerCards({ customers, loading, emptyText, onProfile, onCreateOrder }: CustomerCardsProps) {
  const showDebt = useFeature('customerDebt')
  const showBottles = useFeature('bottleLedger')
  const [sort, setSort] = useState<Sort>('orders')
  const sorted = [...customers].sort((a, b) =>
    sort === 'name'
      ? a.name.localeCompare(b.name, 'vi')
      : sort === 'debt'
        ? b.debt - a.debt
        : sort === 'bottles'
          ? b.bottlesHeld - a.bottlesHeld
          : b.orders - a.orders,
  )

  return (
    <MobileRecordList
      key={sort}
      items={sorted}
      rowKey={(customer) => customer.id}
      loading={loading}
      emptyText={emptyText}
      label="Danh sách khách hàng"
      controls={
        <Select<Sort>
          aria-label="Sắp xếp khách hàng"
          value={sort}
          onChange={setSort}
          options={[
            { value: 'orders', label: 'Số đơn: nhiều trước' },
            { value: 'name', label: 'Tên: A → Z' },
            ...(showDebt ? [{ value: 'debt' as const, label: 'Còn phải thu: cao trước' }] : []),
            ...(showBottles ? [{ value: 'bottles' as const, label: 'Vỏ đang giữ: nhiều trước' }] : []),
          ]}
        />
      }
      renderItem={(customer) => (
        <article className="af-record" aria-label={`Khách hàng ${customer.name}`}>
          <div className="af-record-heading">
            <span>{customerCode(customer)}</span>
            <span>{customer.orders} đơn</span>
          </div>
          <h3>{customer.name}</h3>
          <p className="af-record-meta">
            {customer.phone && <a href={`tel:${customer.phone.replace(/[\s().-]/g, '')}`}>{customer.phone}</a>}
            {customer.area && <span>{customer.area}</span>}
          </p>
          <dl className="af-record-facts">
            <dt>Còn phải thu</dt>
            <dd>{showDebt ? <Money value={customer.debt} tone={customer.debt > 0 ? 'due' : 'paid'} /> : <Unsupported />}</dd>
            <dt>Vỏ đang giữ</dt>
            <dd>{showBottles ? `${customer.bottlesHeld} vỏ` : <Unsupported />}</dd>
          </dl>
          <div className="af-record-actions">
            <Tooltip title="Xem hồ sơ">
              <Button icon={<Eye size={16} />} onClick={() => onProfile(customer.id)} aria-label={`Xem hồ sơ ${customer.name}`} />
            </Tooltip>
            <Button icon={<Plus size={16} />} onClick={() => onCreateOrder(customer)} aria-label={`Tạo đơn cho ${customer.name}`}>
              Tạo đơn
            </Button>
          </div>
        </article>
      )}
    />
  )
}
