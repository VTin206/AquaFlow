import { orderService } from '@/features/orders/orderService'
import { amountDue } from '@/features/orders/types'
import { customerService } from './customerService'

// Chuyển công nợ mẫu sang đúng kiểu của API để bản dùng thử và tài khoản thật dùng chung một màn hình.
export const demoReceivablesApi = {
  customers: async () =>
    (await customerService.list()).map((customer) => ({
      customerId: customer.id,
      name: customer.name,
      active: true,
      due: customer.debt,
      refundDue: 0,
    })),
  receivables: async (customerId: string) =>
    (await orderService.list())
      .filter((order) => order.customerId === customerId && order.status !== 'Đã hủy' && amountDue(order) > 0)
      .map((order) => ({
        orderId: order.id,
        orderCode: order.code ?? order.id,
        paid: order.total - amountDue(order),
        due: amountDue(order),
        refundDue: 0,
      })),
}
