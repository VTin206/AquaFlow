import { api } from '@/shared/api/client'
import type { Supplier, SupplierDraft } from './types'

const phone = (value?: string) => value?.replace(/[\s().-]/g, '') || undefined

// SupplierController (BE2). Chỉ ADMIN được ghi; nhân viên chỉ thấy nhà cung cấp đang dùng.
type SupplierResponse = {
  id: number
  name: string
  phone: string | null
  address: string | null
  active: boolean
  contactName?: string | null
  email?: string | null
}

const fromResponse = (supplier: SupplierResponse): Supplier => ({
  id: String(supplier.id),
  code: `NCC-${String(supplier.id).padStart(3, '0')}`,
  name: supplier.name,
  phone: supplier.phone ?? undefined,
  address: supplier.address ?? undefined,
  active: supplier.active,
  contactName: supplier.contactName ?? undefined,
  email: supplier.email ?? undefined,
})
// Chuỗi rỗng để BE xóa giá trị cũ; BE coi null là giữ nguyên (cho client cũ chưa gửi field này).
const toRequest = (draft: SupplierDraft) => ({
  name: draft.name.trim(),
  phone: phone(draft.phone) ?? null,
  address: draft.address?.trim() || null,
  contactName: draft.contactName?.trim() ?? '',
  email: draft.email?.trim() ?? '',
})

export type SupplierStatus = 'active' | 'inactive' | 'all'

export const supplierApi = {
  list: async (status: SupplierStatus) =>
    (await api.get<SupplierResponse[]>(`/suppliers${status === 'all' ? '' : `?active=${status === 'active'}`}`)).map(fromResponse),
  create: async (draft: SupplierDraft) => fromResponse(await api.post<SupplierResponse>('/suppliers', toRequest(draft))),
  update: async (id: string, draft: SupplierDraft) => fromResponse(await api.put<SupplierResponse>(`/suppliers/${id}`, toRequest(draft))),
  deactivate: (id: string) => api.delete<void>(`/suppliers/${id}`),
  activate: async (id: string) => fromResponse(await api.post<SupplierResponse>(`/suppliers/${id}/reactivate`)),
}
