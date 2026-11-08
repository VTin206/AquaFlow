import type { ReactNode } from 'react'
import { Ban, CircleArrowRight, CircleCheck, Clock3, TriangleAlert, type LucideIcon } from 'lucide-react'
import { MapLink } from '@/shared/address/MapLink'
import { currency } from '@/shared/utils/format'
import type { OrderFocus } from '../orderFocus'
import type { Order, OrderLine } from '../types'

const focusIcons: Record<OrderFocus['tone'], LucideIcon> = {
  action: CircleArrowRight,
  alert: TriangleAlert,
  waiting: Clock3,
  done: CircleCheck,
  muted: Ban,
}

/** Dòng đầu chi tiết đơn: cho biết ngay đơn đang cần gì. */
export function OrderFocusBanner({ focus }: { focus: OrderFocus }) {
  const Icon = focusIcons[focus.tone]
  return (
    <div className={`af-order-focus is-${focus.tone}`}>
      <Icon size={20} aria-hidden />
      <div>
        <strong>{focus.title}</strong>
        {focus.description && <p>{focus.description}</p>}
      </div>
    </div>
  )
}

/** Người nhận và nơi nhận; trường trống thì ẩn thay vì hiện dấu gạch. */
export function OrderParty({ order }: { order: Order }) {
  const tel = order.phone.replace(/[^\d+]/g, '')
  const delivery = order.method === 'Giao tận nơi'
  const place = [order.address, order.floor ? `lầu ${order.floor} (thang bộ)` : '', order.area].filter(Boolean).join(' · ')
  return (
    <section className="af-order-party" aria-label="Người nhận">
      <h3>{delivery ? 'Giao đến' : 'Nhận tại quầy'}</h3>
      <strong>{order.customer}</strong>
      {order.phone && <a href={`tel:${tel}`}>{order.phone}</a>}
      {delivery && place && (
        <p>
          {place}
          <MapLink address={[order.address, order.area].filter(Boolean).join(', ')} />
        </p>
      )}
      {order.appointment && (
        <p>
          <span>Hẹn giao</span> {new Date(order.appointment).toLocaleString('vi-VN')}
        </p>
      )}
      {order.note && (
        <p>
          <span>Ghi chú</span> {order.note}
        </p>
      )}
    </section>
  )
}

/** Hàng và tiền đặt liền nhau; `children` là khối tổng tiền. */
export function OrderLines({ lines, children }: { lines: OrderLine[]; children: ReactNode }) {
  return (
    <section className="af-order-goods" aria-label="Sản phẩm và tiền">
      <h3>Sản phẩm</h3>
      <ul>
        {lines.map((line) => (
          <li key={line.productId}>
            <span>
              {line.name}
              <small>
                {line.quantity}
                {line.unit ? ` ${line.unit.toLowerCase()}` : ''} × {currency(line.unitPrice)}
              </small>
            </span>
            <strong>{currency(line.quantity * line.unitPrice)}</strong>
          </li>
        ))}
      </ul>
      {children}
    </section>
  )
}
