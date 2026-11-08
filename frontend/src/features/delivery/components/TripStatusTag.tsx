import { Tag } from 'antd'
import type { TripViewStatus } from '../tripFocus'

const color: Record<TripViewStatus, string> = {
  'Chờ xuất phát': 'gold',
  'Đang giao': 'cyan',
  'Chờ đối soát': 'orange',
  'Đã đối soát': 'green',
  'Đã hủy': 'default',
}

export function TripStatusTag({ status }: { status: TripViewStatus }) {
  return <Tag color={color[status]}>{status}</Tag>
}
