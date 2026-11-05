import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from '@/shared/api/client'
import { canReadSettings, settingsApi } from './settingsApi'

vi.mock('@/shared/api/client', async (original) => ({
  ...(await original<typeof import('@/shared/api/client')>()),
  api: { get: vi.fn(), put: vi.fn() },
}))
const settings = { storeName: 'Store', address: 'Address', phone: '0901234567', expiryWarningDays: 30, defaultLowStock: 25 }
describe('settings REST contract', () => {
  it('supports translated staff roles and excludes customers and guests', () => {
    for (const role of [
      'ADMIN',
      'SALES_STAFF',
      'DELIVERY_STAFF',
      'Quản trị viên',
      'Nhân viên bán hàng',
      'Nhân viên giao hàng',
      'Chủ cửa hàng',
    ])
      expect(canReadSettings(role)).toBe(true)
    for (const role of [undefined, 'CUSTOMER', 'Khách hàng', 'unknown']) expect(canReadSettings(role)).toBe(false)
  })
  beforeEach(() => vi.clearAllMocks())
  it('loads the version and normalizes empty optional fields for the form', async () => {
    vi.mocked(api.get).mockResolvedValue({ settings: { ...settings, email: null }, version: 7 })
    expect(await settingsApi.get()).toEqual({ ...settings, email: '', version: 7 })
    expect(api.get).toHaveBeenCalledWith('/store-settings')
  })
  it('sends the draft version separately from settings and returns the saved version', async () => {
    vi.mocked(api.put).mockResolvedValue({ settings, version: 8 })
    expect(await settingsApi.update({ ...settings, version: 7 })).toEqual({ ...settings, version: 8 })
    expect(api.put).toHaveBeenCalledWith('/store-settings', { settings, version: 7 })
  })
  it('refuses to save without a loaded version', async () => {
    await expect(settingsApi.update(settings)).rejects.toThrow()
    expect(api.put).not.toHaveBeenCalled()
  })
  it('preserves a conflict without retrying with a newer version', async () => {
    vi.mocked(api.put).mockRejectedValue(new ApiError(409, 'Conflict'))
    await expect(settingsApi.update({ ...settings, version: 7 })).rejects.toMatchObject({ status: 409 })
    expect(api.put).toHaveBeenCalledTimes(1)
    expect(api.get).not.toHaveBeenCalled()
  })
  it('uses the public resource for shop contact details', async () => {
    vi.mocked(api.get).mockResolvedValue({ storeName: 'Store' })
    await settingsApi.profile()
    expect(api.get).toHaveBeenCalledWith('/store-profile')
  })
})
