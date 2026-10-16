import type { OrderStatus } from '../types'

export function StatusBadge({ status }: { status: OrderStatus }) {
  const className = status === 'Đã hoàn tất' ? 'done' : status === 'Đang giao' ? 'shipping' : status === 'Đang chuẩn bị' ? 'preparing' : 'pending'
  return (
    <span className={`status-badge ${className}`}>
      <i />
      {status}
    </span>
  )
}
