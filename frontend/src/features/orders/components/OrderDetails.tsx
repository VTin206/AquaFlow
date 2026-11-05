import { LiveOrderDetails } from '@/features/live/LiveOrderDetails'
import { useIsDemo } from '@/shared/features'
import { OrderDetailsModal } from './OrderDetailsModal'

/** Mở chi tiết đơn; trang gọi không cần biết đơn đến từ dữ liệu mẫu hay API. */
export function OrderDetails({ id, onClose }: { id: string; onClose: () => void }) {
  const demo = useIsDemo()
  return demo ? (
    <OrderDetailsModal key={id} orderId={id} onClose={onClose} />
  ) : (
    <LiveOrderDetails key={id} id={Number(id)} onClose={onClose} />
  )
}
