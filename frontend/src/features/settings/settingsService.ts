import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { db } from '@/mocks/db'
import { mockError, mockRequest } from '@/mocks/mockRequest'
import { logActivity, requireRole } from '@/mocks/session'
import { EXPIRY_WARNING_DAYS } from '@/features/inventory/expiry'
import { useAuth } from '@/features/auth/useAuth'
import { canReadSettings, settingsApi, type SettingsSnapshot } from './settingsApi'
import type { AuthUser } from '@/features/auth/authContext'
import { invalidateLiveData } from '@/features/live/invalidateLiveData'
import type { StoreSettings } from './types'

// Chỉ dùng bộ nhớ cho chế độ dùng thử; tài khoản thật gọi settingsApi.
export const settingsService = {
  get: () => mockRequest(() => db.settings),
  update: (draft: StoreSettings) =>
    mockRequest(() => {
      requireRole(['ADMIN'], 'đổi cài đặt cửa hàng')
      if (!draft.storeName?.trim()) throw mockError(400, 'Nhập tên cửa hàng.')
      if (!draft.address?.trim()) throw mockError(400, 'Nhập địa chỉ cửa hàng.')
      if (!/^(?:0\d{9,10}|84\d{9,10})$/.test((draft.phone ?? '').replace(/\D/g, ''))) throw mockError(400, 'Số điện thoại không hợp lệ.')
      if (draft.taxCode && !/^\d{10}(-\d{3})?$/.test(draft.taxCode.trim()))
        throw mockError(400, 'Mã số thuế gồm 10 chữ số (hoặc 10 số kèm -xxx cho chi nhánh).')
      if (!Number.isSafeInteger(draft.expiryWarningDays) || draft.expiryWarningDays < 1 || draft.expiryWarningDays > 730)
        throw mockError(400, 'Số ngày cảnh báo hạn dùng từ 1 đến 730.')
      if (!Number.isSafeInteger(draft.defaultLowStock) || draft.defaultLowStock < 0)
        throw mockError(400, 'Ngưỡng tồn tối thiểu không hợp lệ.')
      const trimmed = Object.fromEntries(
        Object.entries(draft).map(([key, value]) => [key, typeof value === 'string' ? value.trim() || undefined : value]),
      )
      const changed = Object.keys(trimmed).filter((key) => trimmed[key] !== db.settings[key as keyof StoreSettings])
      db.settings = { ...db.settings, ...trimmed } as StoreSettings
      if (changed.length) logActivity('Cài đặt', 'Cửa hàng', `Cập nhật ${changed.length} mục cài đặt`)
      return db.settings
    }),
}

export const settingsKeys = {
  all: ['settings'] as const,
  live: (user: AuthUser | null) => ['live', 'settings', user?.email ?? user?.name ?? '', user?.role ?? ''] as const,
}

export function useSettings(enabled = true) {
  const { user, demoGuest } = useAuth()
  const demo = Boolean(user?.isDemo || demoGuest)
  return useQuery<SettingsSnapshot>({
    queryKey: demo ? settingsKeys.all : settingsKeys.live(user),
    queryFn: demo ? settingsService.get : settingsApi.get,
    staleTime: 60_000,
    enabled: enabled && (demo || canReadSettings(user?.role)),
  })
}

export const useExpiryWarningDays = () => useSettings().data?.expiryWarningDays ?? EXPIRY_WARNING_DAYS

export function useUpdateSettings() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const demo = Boolean(user?.isDemo)
  return useMutation({
    mutationFn: (draft: SettingsSnapshot) => (demo ? settingsService.update(draft) : settingsApi.update(draft)),
    onSuccess: (settings) => {
      queryClient.setQueryData(demo ? settingsKeys.all : settingsKeys.live(user), settings)
      if (!demo) void invalidateLiveData(queryClient)
    },
  })
}
