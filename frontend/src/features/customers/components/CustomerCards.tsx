import { Button, Select } from 'antd'
import type { ServerPagination } from '@/shared/utils/table'
import type { CustomerCardSort } from '../useCustomers'
import { Plus } from 'lucide-react'
import { ViewButton } from '@/shared/components/ViewButton'
import { MobileRecordList } from '@/shared/components/MobileRecordList'
import { useFeature } from '@/shared/features'
import { Unsupported } from '@/shared/components/Unsupported'
import { customerCode, type Customer } from '../types'
import { CustomerDebt } from './CustomerDebt'
import { lastOrderLabel } from '../lastOrder'

type CustomerCardsProps = {
  /** Một trang khách đã sắp xếp theo `sort` (BE sắp xếp trên toàn bộ danh sách). */
  customers: Customer[]
  loading: boolean
  emptyText: string
  onProfile: (id: string) => void
  onCreateOrder: (customer: Customer) => void
  sort: CustomerCardSort
  onSortChange: (sort: CustomerCardSort) => void
  server: ServerPagination
}
export function CustomerCards({ customers, loading, emptyText, onProfile, onCreateOrder, sort, onSortChange, server }: CustomerCardsProps) {
  const showDebt = useFeature('customerDebt')
  const showBottles = useFeature('bottleLedger')

  return (
    <MobileRecordList
      items={customers}
      rowKey={(customer) => customer.id}
      loading={loading}
      emptyText={emptyText}
      label="Danh sách khách hàng"
      server={server}
      controls={
        <Select<CustomerCardSort>
          aria-label="Sắp xếp khách hàng"
          value={sort}
          onChange={onSortChange}
          options={[
            { value: 'recent', label: 'Mua gần đây trước' },
            { value: 'idle', label: 'Lâu chưa mua trước' },
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
            <span>{lastOrderLabel(customer.lastOrderAt)}</span>
          </div>
          <h3>{customer.name}</h3>
          <p className="af-record-meta">
            {customer.phone && <a href={`tel:${customer.phone.replace(/[\s().-]/g, '')}`}>{customer.phone}</a>}
            {(customer.mainAddress || customer.area) && <span>{customer.mainAddress || customer.area}</span>}
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
