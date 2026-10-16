// Mô hình giao diện cho bản demo; chưa phải API contract của backend.
export type SupplierDraft = {
  name: string
  contactName?: string
  phone: string
  email?: string
  address: string
}

export type Supplier = SupplierDraft & { id: string }
