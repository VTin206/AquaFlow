import { api } from '@/shared/api/client'

export const movementLabels = {
  RECEIVE: 'Nhập từ nhà cung cấp',
  COUNTER_SALE: 'Xuất tại quầy',
  DISPATCH: 'Xuất giao',
  RETURN: 'Nhập hàng hoàn',
  ADJUST_UP: 'Điều chỉnh tăng',
  ADJUST_DOWN: 'Điều chỉnh giảm',
}
export type MovementType = keyof typeof movementLabels
export type InventoryMovement = {
  id: number
  type: MovementType
  quantity: number
  signedQuantity: number
  occurredAt: string
  productId: number
  productName: string
  sku: string
  unit: string
  batchId: number
  lotCode: string
  expiresOn: string
  referenceType: 'ORDER' | 'PURCHASE_RECEIPT'
  referenceId: number
  referenceCode: string
  performedBy: number
  performedByName: string
  reason: string | null
  /** Chỉ dữ liệu mẫu: mã đơn dạng chữ. */
  orderRef?: string
}
export type MovementFilter = { type?: MovementType; productId?: number; from?: string; to?: string; q?: string; page: number; size: number }
export type MovementPage = { content: InventoryMovement[]; page: number; size: number; totalElements: number }
export const movementApi = {
  list: (filter: MovementFilter) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(filter)) if (value !== undefined && value !== '') params.set(key, String(value))
    return api.get<MovementPage>(`/inventory/movements?${params}`)
  },
  detail: (id: number) => api.get<InventoryMovement>(`/inventory/movements/${id}`),
}
