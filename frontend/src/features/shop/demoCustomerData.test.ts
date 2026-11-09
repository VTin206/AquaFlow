// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { orderService } from '@/features/orders/orderService'
import { demoBottleApi } from '@/features/customers/demoBottleLedger'
import { customerService } from '@/features/customers/customerService'
import { demoCustomerAccountApi, demoCustomerOrderApi, rememberDemoOrder, toCustomerOrder } from './demoCustomerData'

describe('dữ liệu khách mẫu theo kiểu API', () => {
  it('đổi trạng thái và dòng hàng sang kiểu API', async () => {
    const [order] = await orderService.list()
    const mapped = toCustomerOrder({ ...order, status: 'Giao thất bại' }, 0)
    expect(mapped.status).toBe('OUT_FOR_DELIVERY')
    expect(mapped.items[0].productName).toBe(order.lines[0].name)
    expect(mapped.items[0].lineTotal).toBe(order.lines[0].unitPrice * order.lines[0].quantity)
  })

  it('liệt kê đơn của khách mẫu và mở được từng đơn', async () => {
    const orders = await demoCustomerOrderApi.list()
    expect(orders.length).toBeGreaterThan(0)
    expect((await demoCustomerOrderApi.detail(orders[0].id)).orderCode).toBe(orders[0].orderCode)
  })

  it('thêm đơn vừa đặt trong tab vào danh sách', async () => {
    const before = await demoCustomerOrderApi.list()
    const other = (await orderService.list()).find((order) => !before.some((item) => item.orderCode === (order.code ?? order.id)))
    expect(other).toBeDefined()
    rememberDemoOrder(other!.id)
    expect(await demoCustomerOrderApi.list()).toHaveLength(before.length + 1)
  })

  it('đánh dấu địa chỉ đầu tiên là mặc định', async () => {
    const addresses = await demoCustomerAccountApi.addresses()
    expect(addresses.filter((address) => address.isDefault).map((address) => address.id)).toEqual([1])
  })
})

describe('sổ vỏ mẫu theo kiểu API', () => {
  it('giữ đúng số dư và cọc phải giữ của khách', async () => {
    const customer = (await customerService.list()).find((item) => item.bottlesHeld > 0)!
    const ledger = await demoBottleApi.ledger(customer.id)
    expect(ledger.balance.bottlesHeld).toBe(customer.bottlesHeld)
    expect(ledger.types[0].held).toBe(customer.bottlesHeld)
    expect(ledger.balance.refundable).toBe(Math.max(0, customer.depositHeld - ledger.balance.requiredDeposit))
  })

  it('giao vỏ làm tăng số vỏ khách giữ và bắt buộc có lý do', async () => {
    const customer = (await customerService.list())[0]
    await expect(demoBottleApi.create(customer.id, { requestId: 'x', kind: 'GIVE', quantity: 1 })).rejects.toThrow('lý do')
    await demoBottleApi.create(customer.id, { requestId: 'y', kind: 'GIVE', quantity: 2, note: 'Giao tại quầy' })
    expect((await demoBottleApi.ledger(customer.id)).balance.bottlesHeld).toBe(customer.bottlesHeld + 2)
  })
})
