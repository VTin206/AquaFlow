import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { db } from '@/mocks/db'
import { mockError, mockRequest } from '@/mocks/mockRequest'
import { logActivity, requireRole } from '@/mocks/session'
import { EXPIRY_WARNING_DAYS } from '@/features/inventory/expiry'
import type { StoreSettings } from './types'

// Dữ liệu trong bộ nhớ như các trang khác; thay bằng api.get/put khi backend có API cài đặt.
export const settingsService = {
  get: () => mockRequest(() => db.settings),
  update: (draft: StoreSettings) =>
    mockRequest(() => {
      requireRole(['ADMIN'], 'đổi cài đặt cửa hàng')
      if (!draft.storeName?.trim()) throw mockError(400, 'Nhập tên cửa hàng.')
      if (!draft.address?.trim()) throw mockError(400, 'Nhập địa chỉ cửa hàng.')
      if (!/^(?:0\d{9,10}|84\d{9,10})$/.test((draft.phone ?? '').replace(/\D/g, ''))) throw mockError(400, 'Số điện thoại không hợp lệ.')
      if (draft.taxCode && !/^\d{10}(-\d{3})?$/.test(draft.taxCode.trim())) throw mockError(400, 'Mã số thuế gồm 10 chữ số (hoặc 10 số kèm -xxx cho chi nhánh).')
      if (!Number.isSafeInteger(draft.expiryWarningDays) || draft.expiryWarningDays < 1 || draft.expiryWarningDays > 730) throw mockError(400, 'Số ngày cảnh báo hạn dùng từ 1 đến 730.')
      if (!Number.isSafeInteger(draft.defaultLowStock) || draft.defaultLowStock < 0) throw mockError(400, 'Ngưỡng tồn tối thiểu không hợp lệ.')
      const trimmed = Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, typeof value === 'string' ? value.trim() || undefined : value]))
      const changed = Object.keys(trimmed).filter((key) => trimmed[key] !== db.settings[key as keyof StoreSettings])
      db.settings = { ...db.settings, ...trimmed } as StoreSettings
      if (changed.length) logActivity('Cài đặt', 'Cửa hàng', `Cập nhật ${changed.length} mục cài đặt`)
      return db.settings
    }),
}

export const settingsKeys = { all: ['settings'] as const }

export const useSettings = (enabled = true) => useQuery({ queryKey: settingsKeys.all, queryFn: settingsService.get, staleTime: Infinity, enabled })

/** Ngưỡng cảnh báo hạn dùng hiện hành (mặc định khi chưa tải xong cài đặt). */
export const useExpiryWarningDays = () => useSettings().data?.expiryWarningDays ?? EXPIRY_WARNING_DAYS

export function useUpdateSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: settingsService.update,
    onSuccess: (settings) => queryClient.setQueryData(settingsKeys.all, settings),
  })
}
