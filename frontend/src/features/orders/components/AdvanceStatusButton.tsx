import { App, Button, Typography } from 'antd'
import { nextActionLabel } from '../orderStatus'
import type { Order } from '../types'
import { useAdvanceOrderStatus } from '../useOrders'

/** Nút ghi rõ bước tiếp theo của đơn (Xác nhận → Bắt đầu giao → Hoàn tất). */
export function AdvanceStatusButton({ order }: { order: Order }) {
  const { message } = App.useApp()
  const advance = useAdvanceOrderStatus()
  const label = nextActionLabel[order.status]

  if (!label) return <Typography.Text type="secondary">—</Typography.Text>

  const pendingThisOrder = advance.isPending && advance.variables === order.id
  return (
    <Button
      size="small"
      type={order.status === 'Chờ xác nhận' ? 'primary' : 'default'}
      loading={pendingThisOrder}
      onClick={() =>
        advance.mutate(order.id, {
          onSuccess: (updated) => message.success(`Đơn ${updated.id} chuyển sang "${updated.status}".`),
          onError: (error) => message.error(error.message),
        })
      }
    >
      {label}
    </Button>
  )
}
