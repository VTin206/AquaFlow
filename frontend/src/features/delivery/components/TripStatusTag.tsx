import { Tag } from 'antd'
import type { TripStatus } from '../types'

const color: Record<TripStatus, string> = {
  'Chờ xuất phát': 'gold',
  'Đang giao': 'cyan',
  'Chờ đối soát': 'orange',
  'Đã đối soát': 'green',
}

export function TripStatusTag({ status }: { status: TripStatus }) {
  return <Tag color={color[status]}>{status}</Tag>
}
