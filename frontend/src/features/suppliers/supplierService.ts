import { db } from '../../mocks/db'
import { mockRequest } from '../../mocks/mockRequest'
import type { Supplier, SupplierDraft } from './types'

// Dữ liệu trong bộ nhớ, cùng cơ chế demo với các trang hiện tại.
// Thay phần triển khai service khi nhóm thống nhất API nhà cung cấp.
export const supplierService = {
  list: () => mockRequest(() => db.suppliers),
  create: (draft: SupplierDraft) => mockRequest(() => {
    const nextId = Math.max(0, ...db.suppliers.map((supplier) => Number(supplier.id.replace('NCC-', '')) || 0)) + 1
    const supplier: Supplier = {
      id: `NCC-${String(nextId).padStart(3, '0')}`,
      name: draft.name.trim(),
      contactName: draft.contactName?.trim() || undefined,
      phone: draft.phone.replace(/[\s().-]/g, ''),
      email: draft.email?.trim() || undefined,
      address: draft.address.trim(),
    }
    db.suppliers.unshift(supplier)
    return supplier
  }),
}
