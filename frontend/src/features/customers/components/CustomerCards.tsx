import { useState } from 'react'
import { Button, Select } from 'antd'
import { Plus } from 'lucide-react'
import { ViewButton } from '@/shared/components/ViewButton'
import { MobileRecordList } from '@/shared/components/MobileRecordList'
import { useFeature } from '@/shared/features'
import { Unsupported } from '@/shared/components/Unsupported'
import { customerCode, type Customer } from '../types'
import { CustomerDebt } from './CustomerDebt'

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
            <dd>{showDebt ? <CustomerDebt debt={customer.debt} orders={customer.orders} /> : <Unsupported />}</dd>
            <dt>Vỏ đang giữ</dt>
            <dd>{showBottles ? `${customer.bottlesHeld} vỏ` : <Unsupported />}</dd>
          </dl>
          <div className="af-record-actions">
            <ViewButton title="Xem hồ sơ" subject={customer.name} size="middle" onClick={() => onProfile(customer.id)} />
            <Button icon={<Plus size={16} />} onClick={() => onCreateOrder(customer)} aria-label={`Tạo đơn cho ${customer.name}`}>
              Tạo đơn
            </Button>
          </div>
        </article>
      )}
    />
  )
}
