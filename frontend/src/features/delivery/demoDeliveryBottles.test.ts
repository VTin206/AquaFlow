// @vitest-environment jsdom
import { expect, test } from 'vitest'
import { bottleBalance } from '@/features/customers/customerService'
import { orderService } from '@/features/orders/orderService'
import { demoDeliveryBottles } from './demoDeliveryBottles'

const input = (quantity: number, requestId: string) => ({ requestId, lines: [{ bottleTypeId: 1, quantity }] })

test('thu vỏ của đơn đã giao ghi vào sổ khách và không vượt số còn được thu', async () => {
  const orders = await orderService.list()
  const candidates = await Promise.all(
    orders
      .filter((order) => order.customerId && order.deliveredAt)
      .map(async (order) => ({ order, view: await demoDeliveryBottles.get(order) })),
  )
  const found = candidates.find(
    ({ order, view }) => view.lines[0] && view.lines[0].given > view.lines[0].returned && bottleBalance(order.customerId!).bottles > 0,
  )
  expect(found).toBeDefined()
  const { order, view } = found!
  const held = bottleBalance(order.customerId!).bottles

  const after = await demoDeliveryBottles.receive(order, input(1, 'r1'))
  expect(after.lines[0].returned).toBe(view.lines[0].returned + 1)
  expect(after.receipts).toHaveLength(1)
  expect(bottleBalance(order.customerId!).bottles).toBe(held - 1)

  await expect(demoDeliveryBottles.receive(order, input(after.lines[0].given + 1, 'r2'))).rejects.toThrow()
})
