// @vitest-environment jsdom
import { expect, test } from 'vitest'
import { DEPOSIT_PER_BOTTLE } from '@/shared/policy'
import { demoBottleApi } from './demoBottleLedger'
import { demoReceivablesApi } from './demoReceivables'

test('công nợ từng khách khớp tổng các đơn còn phải thu', async () => {
  const customers = (await demoReceivablesApi.customers()).filter((customer) => customer.due > 0)
  expect(customers.length).toBeGreaterThan(0)
  for (const customer of customers) {
    const orders = await demoReceivablesApi.receivables(customer.customerId)
    expect(orders.reduce((sum, order) => sum + order.due, 0)).toBe(customer.due)
  }
})

test('sổ vỏ tổng hợp tính cọc cần giữ và phần có thể hoàn theo số vỏ', async () => {
  const balances = await demoBottleApi.balances()
  expect(balances.length).toBeGreaterThan(0)
  for (const balance of balances) {
    expect(balance.requiredDeposit).toBe(balance.bottlesHeld * DEPOSIT_PER_BOTTLE)
    expect(balance.refundable).toBe(Math.max(0, balance.depositHeld - balance.requiredDeposit))
  }
})
