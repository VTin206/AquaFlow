import { LiveOrderDetails } from '@/features/live/LiveOrderDetails'

/** Mở chi tiết đơn theo id. */
export function OrderDetails({ id, onClose }: { id: string; onClose: () => void }) {
  return <LiveOrderDetails key={id} id={Number(id)} onClose={onClose} />
}
