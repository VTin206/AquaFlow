import { App, Button } from 'antd'
import { Copy } from 'lucide-react'
import { orderConfirmationMessage } from '../orderMessage'
import type { Order } from '../types'

/** Sao chép tin nhắn xác nhận đơn; trình duyệt chặn thì báo để nhân viên tự soạn. */
export function CopyOrderMessageButton({ order, storeName }: { order: Order; storeName?: string }) {
  const { message } = App.useApp()
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(orderConfirmationMessage(order, storeName))
      message.success('Đã sao chép tin nhắn xác nhận.')
    } catch {
      message.error('Trình duyệt không cho sao chép. Vui lòng thử lại.')
    }
  }
  return (
    <Button icon={<Copy size={15} />} onClick={() => void copy()}>
      Sao chép tin nhắn
    </Button>
  )
}
