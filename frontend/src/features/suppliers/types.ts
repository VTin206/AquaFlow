// Kiểu dùng chung cho giao diện, chuyển từ SupplierResponse.
export type SupplierDraft = {
  name: string
  contactName?: string
  phone: string
  email?: string
  address: string
}

export type Supplier = Omit<SupplierDraft, 'phone' | 'address'> & {
  id: string
  /** Mã hiển thị, ví dụ NCC-001. */
  code: string
  phone?: string
  address?: string
  active: boolean
}
