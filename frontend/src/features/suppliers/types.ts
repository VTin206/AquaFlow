// Kiểu dùng chung cho giao diện; bản dùng thử đọc mock, tài khoản thật chuyển từ SupplierResponse.
export type SupplierDraft = {
  name: string
  contactName?: string
  phone: string
  email?: string
  address: string
}

/** Bản ghi lưu trong mock; thiếu `active` nghĩa là đang dùng. */
export type SupplierRecord = SupplierDraft & { id: string; active?: boolean }

export type Supplier = Omit<SupplierDraft, 'phone' | 'address'> & {
  id: string
  /** Mã hiển thị, ví dụ NCC-001. */
  code: string
  phone?: string
  address?: string
  active: boolean
}
