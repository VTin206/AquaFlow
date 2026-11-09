import { addBottleEntry, bottleBalance } from '@/features/customers/customerService'
import { jugCount, type Order } from '@/features/orders/types'
import { mockError, mockRequest } from '@/mocks/mockRequest'
import { mockActor } from '@/mocks/session'
import { DEPOSIT_PER_BOTTLE } from '@/shared/policy'
import type { BottleReturnInput, DeliveryBottles } from './deliveryBottleApi'

// Vỏ theo đơn mẫu đúng kiểu của API để bản dùng thử và tài khoản thật dùng chung cửa sổ "Vỏ của đơn".
const TYPE_ID = 1
const TYPE_NAME = 'Vỏ bình 20L'
const receipts = new Map<string, DeliveryBottles['receipts']>()

const receiptsOf = (order: Order) => receipts.get(order.id) ?? []
const givenOf = (order: Order) => order.bottles?.delivered ?? jugCount(order)
const returnedOf = (order: Order) => (order.bottles?.returned ?? 0) + receiptsOf(order).reduce((sum, receipt) => sum + receipt.quantity, 0)

const view = (order: Order): DeliveryBottles => {
  const given = givenOf(order)
  const delivered = Boolean(order.deliveredAt)
  return {
    tracked: true,
    linkedCustomer: Boolean(order.customerId),
    given: delivered,
    canReturn: delivered && Boolean(order.customerId),
    lines:
      given > 0 ? [{ bottleTypeId: TYPE_ID, name: TYPE_NAME, given, returned: returnedOf(order), unitDeposit: DEPOSIT_PER_BOTTLE }] : [],
    receipts: receiptsOf(order),
  }
}

export const demoDeliveryBottles = {
  get: (order: Order) => mockRequest(() => view(order)),
  receive: (order: Order, input: BottleReturnInput) =>
    mockRequest(() => {
      const quantity = input.lines.reduce((sum, line) => sum + line.quantity, 0)
      if (!order.customerId) throw mockError(400, 'Đơn chưa liên kết hồ sơ khách hàng.')
      if (quantity > givenOf(order) - returnedOf(order)) throw mockError(400, 'Số vỏ vượt số còn được thu của đơn.')
      if (quantity > bottleBalance(order.customerId).bottles) throw mockError(400, 'Số vỏ vượt số khách đang giữ.')
      addBottleEntry({
        customerId: order.customerId,
        kind: 'Thu vỏ',
        bottles: -quantity,
        deposit: 0,
        orderId: order.id,
        note: 'Tài xế thu khi giao',
      })
      receipts.set(order.id, [
        { requestId: input.requestId, typeName: TYPE_NAME, quantity, actor: mockActor(), at: new Date().toISOString() },
        ...receiptsOf(order),
      ])
      return view(order)
    }),
}
