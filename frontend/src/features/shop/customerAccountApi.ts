import { api } from '@/shared/api/client'

export type CustomerProfile = { fullName: string; email: string; phone: string | null }
export type AddressInput = { recipientName: string; recipientPhone: string; addressLine: string; area: string; isDefault: boolean }
export type SavedAddress = AddressInput & { id: number; customerId: number }
/** Vỏ khách đang giữ theo loại; cọc tính chung cho khách (đã nộp, cần có cho số vỏ đang giữ, còn được hoàn). */
export type CustomerBottles = {
  bottles: { bottleTypeId: number; name: string; holding: number; unitDeposit: number }[]
  depositPaid: number
  depositRequired: number
  refundable: number
}
export type PasswordChange = { currentPassword: string; newPassword: string }
const base = '/customer/account'
export const customerAccountApi = {
  profile: () => api.get<CustomerProfile>(`${base}/profile`),
  updateProfile: (input: Pick<CustomerProfile, 'fullName' | 'phone'>) => api.put<CustomerProfile>(`${base}/profile`, input),
  addresses: () => api.get<SavedAddress[]>(`${base}/addresses`),
  createAddress: (input: AddressInput) => api.post<SavedAddress>(`${base}/addresses`, input),
  updateAddress: (id: number, input: AddressInput) => api.put<SavedAddress>(`${base}/addresses/${id}`, input),
  deleteAddress: (id: number) => api.delete<void>(`${base}/addresses/${id}`),
  bottles: () => api.get<CustomerBottles>(`${base}/bottles`),
  /** Thành công thì mọi phiên hết hạn: client đăng xuất và mời đăng nhập lại. */
  changePassword: (input: PasswordChange) => api.post<void>(`${base}/password`, input),
}
export const accountKey = (email?: string) => ['live', 'customer-account', email] as const
export const phoneRules = [
  { required: true, message: 'Nhập số điện thoại.' },
  { pattern: /^(?:0\d{9,10}|\+84\d{9,10})$/, transform: (value?: string) => value?.replace(/[\s().-]/g, ''), message: 'Số điện thoại không hợp lệ.' },
]
