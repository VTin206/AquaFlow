import { Tag } from 'antd'
import { statusColor } from '../orderStatus'
import type { OrderStatus } from '../types'

export function OrderStatusTag({ status }: { status: OrderStatus }) {
  return <Tag color={statusColor[status]}>{status}</Tag>
}
