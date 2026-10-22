import { Tag } from 'antd'
import { isOverdue, lateLabel, minutesLate, type Order } from '../types'

/** Đỏ: đơn chưa giao đã quá giờ hẹn. Cam: đã giao nhưng trễ so với giờ hẹn. */
export function LateTag({ order }: { order: Order }) {
  const late = minutesLate(order)
  if (!late) return null
  return isOverdue(order) ? <Tag color="red">Trễ hẹn {lateLabel(late)}</Tag> : <Tag color="orange">Giao trễ {lateLabel(late)}</Tag>
}
