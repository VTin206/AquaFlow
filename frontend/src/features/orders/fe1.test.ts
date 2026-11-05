import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from '@/shared/api/client'
import { accountDestination, isCustomer, isStaff } from '@/features/auth/accountAccess'
import { customerOrderApi } from '@/features/shop/customerOrderApi'
import { progressSteps } from './orderProgressSteps'
import { orderDeliveryHistory } from './orderDeliveryApi'
import { deliveryApi } from '@/features/delivery/deliveryApi'
vi.mock('@/shared/api/client', async (original) => ({
  ...(await original<typeof import('@/shared/api/client')>()),
  api: { get: vi.fn(), post: vi.fn() },
}))
vi.mock('@/features/delivery/deliveryApi', () => ({ deliveryApi: { list: vi.fn(), attempts: vi.fn() } }))

describe('FE1 access and API contracts', () => {
  beforeEach(() => vi.clearAllMocks())
  it('keeps customer accounts out of the staff workspace, including legacy translated roles', () => {
    for (const role of ['CUSTOMER', 'Khách hàng']) {
      const user = { name: 'Customer', role }
      expect(isStaff(user)).toBe(false)
      expect(isCustomer(user)).toBe(true)
      expect(accountDestination(user, '/delivery')).toBe('/shop/orders')
      expect(accountDestination(user, '/shop/orders/12')).toBe('/shop/orders/12')
      expect(accountDestination(user, '//example.com')).toBe('/shop/orders')
    }
    expect(accountDestination({ name: 'Sales', role: 'SALES_STAFF' }, '/settings')).toBe('/')
    expect(accountDestination({ name: 'Driver', role: 'DELIVERY_STAFF' })).toBe('/driver')
    expect(accountDestination({ name: 'Admin', role: 'ADMIN' }, '/login')).toBe('/')
    expect(isStaff({ name: 'Unknown', role: 'unknown' })).toBe(false)
  })
  it('loads customer orders exclusively through the identity-scoped resource', async () => {
    vi.mocked(api.get).mockResolvedValue([])
    await customerOrderApi.list()
    await customerOrderApi.detail(12)
    expect(api.get).toHaveBeenNthCalledWith(1, '/customer/orders')
    expect(api.get).toHaveBeenNthCalledWith(2, '/customer/orders/12')
  })
  it('treats a missing customer profile as empty but preserves network/authorization errors', async () => {
    vi.mocked(api.get).mockRejectedValue(new ApiError(404, 'No profile'))
    expect(await customerOrderApi.list()).toEqual([])
    await expect(customerOrderApi.detail(99)).rejects.toMatchObject({ status: 404 })
    for (const status of [0, 401, 403, 500]) {
      vi.mocked(api.get).mockRejectedValue(new ApiError(status, 'Failure'))
      await expect(customerOrderApi.list()).rejects.toMatchObject({ status })
    }
  })
  it('associates authenticated checkout with the current customer without accepting a client customer id', async () => {
    const draft = {
      recipientName: 'Customer',
      recipientPhone: '0901234567',
      deliveryAddress: 'Address',
      deliveryArea: 'Area',
      items: [{ productId: 1, quantity: 2 }],
    }
    await customerOrderApi.create(draft)
    expect(api.post).toHaveBeenCalledWith('/customer/orders', { ...draft, channel: 'WEB', fulfillmentType: 'DELIVERY' })
  })
  it('shows all delivery stages without treating DELIVERED as COMPLETED', () => {
    expect(progressSteps({ fulfillmentType: 'DELIVERY', status: 'PREPARING' }).current).toBe(2)
    expect(progressSteps({ fulfillmentType: 'DELIVERY', status: 'OUT_FOR_DELIVERY' }).current).toBe(3)
    expect(progressSteps({ fulfillmentType: 'DELIVERY', status: 'DELIVERED' }).current).toBe(4)
    expect(progressSteps({ fulfillmentType: 'COUNTER', status: 'DELIVERED' }).states).not.toContain('OUT_FOR_DELIVERY')
  })
  it('loads full attempt histories only for trips containing the selected order', async () => {
    vi.mocked(deliveryApi.list).mockResolvedValue([
      { id: 2, createdAt: '2026-11-02', orders: [{ orderId: 12 }] },
      { id: 1, createdAt: '2026-11-01', orders: [{ orderId: 12 }] },
      { id: 3, createdAt: '2026-11-03', orders: [{ orderId: 99 }] },
    ] as Awaited<ReturnType<typeof deliveryApi.list>>)
    vi.mocked(deliveryApi.attempts).mockResolvedValue([
      { id: 2, attemptNo: 2, outcome: 'SUCCESS' },
      { id: 1, attemptNo: 1, outcome: 'FAILED' },
    ] as Awaited<ReturnType<typeof deliveryApi.attempts>>)
    const history = await orderDeliveryHistory(12)
    expect(history.map((row) => row.trip.id)).toEqual([1, 2])
    expect(history[0].attempts.map((attempt) => attempt.outcome)).toEqual(['FAILED', 'SUCCESS'])
    expect(deliveryApi.attempts).toHaveBeenCalledTimes(2)
    expect(deliveryApi.attempts).not.toHaveBeenCalledWith(3, 12)
  })
})
