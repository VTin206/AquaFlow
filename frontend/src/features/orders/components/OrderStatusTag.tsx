import { Tag } from 'antd'
import { statusColor } from '../orderStatus'
import type { Order, OrderStatus } from '../types'

export function OrderStatusTag({ status, method }: { status: OrderStatus; method?: Order['method'] }) {
  return <Tag color={statusColor[status]}>{status === 'Đã giao' && method === 'Tại quầy' ? 'Đã nhận tại quầy' : status}</Tag>
}
