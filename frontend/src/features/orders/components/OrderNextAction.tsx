import type { ButtonProps } from 'antd'
import { LiveConfirmButton } from '@/features/live/LiveConfirmButton'
import { useIsDemo } from '@/shared/features'
import { nextActionLabel } from '../orderStatus'
import type { Order } from '../types'
import { AdvanceStatusButton } from './AdvanceStatusButton'

/**
 * Bước tiếp theo của đơn ngay trên danh sách; không có bước nào thì không hiện.
 * API thật hiện chỉ cho xác nhận ở đây, các bước sau nằm trong chi tiết đơn. `dense` dùng cho cột thao tác hẹp.
 */
export function OrderNextAction({ order, size, dense = false }: { order: Order; size?: ButtonProps['size']; dense?: boolean }) {
  const demo = useIsDemo()
  if (demo) return nextActionLabel(order) ? <AdvanceStatusButton order={order} size={size} menu={dense} /> : null
  return order.status === 'Chờ xác nhận' ? <LiveConfirmButton order={order} size={size} iconOnly={dense} /> : null
}
