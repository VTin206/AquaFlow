import type { ButtonProps } from 'antd'
import { LiveConfirmButton } from '@/features/live/LiveConfirmButton'
import type { Order } from '../types'

/**
 * Bước tiếp theo của đơn ngay trên danh sách; không có bước nào thì không hiện.
 * API thật hiện chỉ cho xác nhận ở đây, các bước sau nằm trong chi tiết đơn. `dense` dùng cho cột thao tác hẹp.
 */
export function OrderNextAction({ order, size, dense = false }: { order: Order; size?: ButtonProps['size']; dense?: boolean }) {
  return order.status === 'Chờ xác nhận' ? <LiveConfirmButton order={order} size={size} iconOnly={dense} /> : null
}
