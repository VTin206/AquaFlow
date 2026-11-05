import { useState } from 'react'
import { App, Button, Dropdown, Typography, type ButtonProps } from 'antd'
import { Ellipsis } from 'lucide-react'
import { nextActionLabel } from '../orderStatus'
import type { Order } from '../types'
import { useAdvanceOrderStatus } from '../useOrders'
import { ReceiveOrderModal } from './ReceiveOrderModal'

/** Nút ghi rõ bước tiếp theo của đơn (Xác nhận → Bắt đầu giao → Hoàn tất). */
export function AdvanceStatusButton({ order, menu = false, size = 'small' }: { order: Order; menu?: boolean; size?: ButtonProps['size'] }) {
  const { message } = App.useApp()
  const advance = useAdvanceOrderStatus()
  const [receiving, setReceiving] = useState(false)
  const label = nextActionLabel(order)

  if (!label) return menu ? null : <Typography.Text type="secondary">—</Typography.Text>

  const pendingThisOrder = advance.isPending && advance.variables === order.id
  const handleAdvance = () => {
    if (order.status === 'Đang giao' || (order.method === 'Tại quầy' && order.status === 'Đang chuẩn bị')) {
      setReceiving(true)
      return
    }
    advance.mutate(order.id, {
      onSuccess: (updated) => message.success(`Đơn ${updated.id} chuyển sang "${updated.status}".`),
      onError: (error) => message.error(error.message),
    })
  }
  return (
    <>
      {menu ? (
        <Dropdown trigger={['click']} menu={{ items: [{ key: 'advance', label, disabled: pendingThisOrder, onClick: handleAdvance }] }}>
          <Button size="small" icon={<Ellipsis size={16} />} loading={pendingThisOrder} aria-label={`Thao tác đơn ${order.id}`} />
        </Dropdown>
      ) : (
        <Button
          size={size}
          type={order.status === 'Chờ xác nhận' ? 'primary' : 'default'}
          loading={pendingThisOrder}
          onClick={handleAdvance}
        >
          {label}
        </Button>
      )}
      <ReceiveOrderModal order={order} open={receiving} onClose={() => setReceiving(false)} />
    </>
  )
}
