import { db } from '@/mocks/db'
import { mockError, mockRequest } from '@/mocks/mockRequest'
import { logActivity, requireRole } from '@/mocks/session'
import { api } from '@/shared/api/client'
import type { Supplier, SupplierDraft, SupplierRecord } from './types'

const phone = (value?: string) => value?.replace(/[\s().-]/g, '') || undefined
const fromRecord = (record: SupplierRecord): Supplier => ({ ...record, code: record.id, active: record.active ?? true })

const findRecord = (id: string) => {
  const record = db.suppliers.find((supplier) => supplier.id === id)
  if (!record) throw mockError(404, 'Không tìm thấy nhà cung cấp.')
  return record
}

// Bản dùng thử: dữ liệu trong bộ nhớ, cùng cơ chế demo với các trang khác.
export const supplierService = {
  list: () => mockRequest(() => db.suppliers.map(fromRecord)),
  create: (draft: SupplierDraft) =>
    mockRequest(() => {
      requireRole(['ADMIN', 'SALES_STAFF'], 'thêm nhà cung cấp')
      const nextId = Math.max(0, ...db.suppliers.map((supplier) => Number(supplier.id.replace('NCC-', '')) || 0)) + 1
      const record: SupplierRecord = {
        id: `NCC-${String(nextId).padStart(3, '0')}`,
        name: draft.name.trim(),
        contactName: draft.contactName?.trim() || undefined,
        phone: phone(draft.phone) ?? '',
        email: draft.email?.trim() || undefined,
        address: draft.address.trim(),
      }
      db.suppliers.unshift(record)
      logActivity('Nhà cung cấp', record.id, `Thêm nhà cung cấp ${record.name}`)
      return fromRecord(record)
    }),
  update: (id: string, draft: SupplierDraft) =>
    mockRequest(() => {
      requireRole(['ADMIN', 'SALES_STAFF'], 'sửa nhà cung cấp')
      const record = findRecord(id)
      Object.assign(record, {
        name: draft.name.trim(),
        contactName: draft.contactName?.trim() || undefined,
        phone: phone(draft.phone) ?? '',
        email: draft.email?.trim() || undefined,
        address: draft.address.trim(),
      })
      logActivity('Nhà cung cấp', id, `Sửa thông tin ${record.name}`)
      return fromRecord(record)
    }),
  deactivate: (id: string) =>
    mockRequest(() => {
      requireRole(['ADMIN', 'SALES_STAFF'], 'ngừng hợp tác với nhà cung cấp')
      const record = findRecord(id)
      record.active = false
      logActivity('Nhà cung cấp', id, `Ngừng hợp tác với ${record.name}`)
    }),
  activate: (id: string) =>
    mockRequest(() => {
      requireRole(['ADMIN', 'SALES_STAFF'], 'hợp tác lại với nhà cung cấp')
      const record = findRecord(id)
      record.active = true
      logActivity('Nhà cung cấp', id, `Hợp tác lại với ${record.name}`)
    }),
}

// Tài khoản thật: SupplierController (BE2). Chỉ ADMIN được ghi; nhân viên chỉ thấy nhà cung cấp đang dùng.
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
}
