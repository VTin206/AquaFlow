import { App } from 'antd'
import { orderConfirmationMessage } from './orderMessage'
import type { Order } from './types'

/** Sao chép tin nhắn xác nhận đơn; trình duyệt chặn thì báo để nhân viên thử lại. */
export function useCopyOrderMessage() {
  const { message } = App.useApp()
  return async (order: Order, storeName?: string) => {
    try {
      await navigator.clipboard.writeText(orderConfirmationMessage(order, storeName))
      message.success('Đã sao chép tin nhắn xác nhận.')
    } catch {
      message.error('Trình duyệt không cho sao chép. Vui lòng thử lại.')
    }
  }
}
