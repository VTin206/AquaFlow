import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import { staffApi } from './staffApi'
import { canOpen, homeOf } from './permissions'
import { collectionApi } from '@/features/delivery/deliveryApi'
vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }))
describe('staff accounts and delivery REST resources', () => {
  beforeEach(() => vi.clearAllMocks())
  it('creates the selected staff role and uses the password subresource', async () => {
    const draft = { fullName: 'Staff', email: 'staff@test.com', role: 'SALES_STAFF' as const, password: 'Test-password-2026' }
    await staffApi.create(draft)
    expect(api.post).toHaveBeenCalledWith('/admin/staff', draft)
    await staffApi.password(12, 'Replacement-password')
    expect(api.put).toHaveBeenCalledWith('/admin/staff/12/password', { password: 'Replacement-password' })
  })
  it('updates account status without sending a password', async () => {
    await staffApi.update(12, { fullName: 'Staff', status: 'INACTIVE' })
    expect(api.put).toHaveBeenCalledWith('/admin/staff/12', { fullName: 'Staff', status: 'INACTIVE' })
  })
  it('uses the assigned trip and a stable request id for collections', async () => {
    const input = { requestId: 'stable-id', amount: 10000, method: 'CASH' as const, bottlesReturned: 1 }
    await collectionApi.collect(2, 3, input)
    await collectionApi.collect(2, 3, input)
    expect(api.post).toHaveBeenNthCalledWith(1, '/delivery/trips/2/orders/3/collections', input)
    expect(api.post).toHaveBeenNthCalledWith(2, '/delivery/trips/2/orders/3/collections', input)
  })
  it('keeps staff management private and directs drivers to their own workspace', () => {
    expect(canOpen('ADMIN', '/staff')).toBe(true)
    for (const role of ['SALES_STAFF', 'DELIVERY_STAFF'] as const) {
      expect(canOpen(role, '/staff')).toBe(false)
      expect(canOpen(role, '/settings')).toBe(false)
    }
    expect(homeOf('DELIVERY_STAFF')).toBe('/driver')
    expect(canOpen('DELIVERY_STAFF', '/driver')).toBe(true)
    expect(canOpen('ADMIN', '/driver')).toBe(false)
    expect(canOpen('SALES_STAFF', '/driver')).toBe(false)
    expect(canOpen('SALES_STAFF', '/delivery')).toBe(true)
    expect(canOpen('DELIVERY_STAFF', '/orders')).toBe(false)
  })
})
