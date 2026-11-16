import { api } from '@/shared/api/client'
import type { StoreSettings } from './types'
import { roleLabel, STAFF_ROLES } from '@/features/auth/roles'

export const canReadSettings = (role?: string) =>
  STAFF_ROLES.some((code) => role === code || role === roleLabel(code)) || role === 'Chủ cửa hàng'

export type SettingsSnapshot = StoreSettings & { version?: number }
type Response = { settings: StoreSettings; version: number; updatedAt: string; updatedBy: number | null }
/** Hồ sơ công khai; `bank*` chỉ có khi backend công bố tài khoản nhận chuyển khoản cho khách. */
export type StoreProfile = Pick<StoreSettings, 'storeName' | 'address' | 'phone' | 'email' | 'openingHours'> &
  Partial<Pick<StoreSettings, 'bankName' | 'bankAccount' | 'bankHolder'>>
const snapshot = (response: Response): SettingsSnapshot =>
  ({
    ...Object.fromEntries(Object.entries(response.settings).map(([key, value]) => [key, value ?? ''])),
    version: response.version,
  }) as SettingsSnapshot
export const settingsApi = {
  get: () => api.get<Response>('/store-settings').then(snapshot),
  update: (draft: SettingsSnapshot) => {
    if (draft.version === undefined) return Promise.reject(new Error('Tải lại cài đặt trước khi lưu.'))
    const { version, ...settings } = draft
    return api.put<Response>('/store-settings', { settings, version }).then(snapshot)
  },
  profile: () => api.get<StoreProfile>('/store-profile'),
}
