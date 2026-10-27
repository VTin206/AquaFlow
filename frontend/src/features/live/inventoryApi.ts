import { api } from '../../shared/api/client'

/** DTO theo StockController/PurchaseReceiptController (BE2). */
export type BatchStock = { batchId: number; lotCode: string; expiresOn: string; expired: boolean; onHand: number; reserved: number; available: number }
export type ProductStock = {
  productId: number; sku: string; productName: string
  onHand: number; reserved: number; available: number; expiredOnHand: number
  batches: BatchStock[]
}

export type ReceiptStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED'
export const receiptStatusLabels: Record<ReceiptStatus, string> = { DRAFT: 'Nháp', CONFIRMED: 'Đã nhập kho', CANCELLED: 'Đã hủy' }
export const receiptStatusColors: Record<ReceiptStatus, string> = { DRAFT: 'blue', CONFIRMED: 'green', CANCELLED: 'default' }

export type ReceiptItem = {
  id: number; productId: number; productName: string; batchId: number; lotCode: string
  manufacturedOn: string | null; expiresOn: string
  quantityReceived: number; quantityAccepted: number; quantityRejected: number; unitCost: number
}
export type PurchaseReceipt = {
  id: number; supplierId: number; supplierName: string; status: ReceiptStatus
  receivedAt: string; createdBy: number | null; confirmedBy: number | null; confirmedAt: string | null
  note: string | null; items: ReceiptItem[]
}
export type ReceiptInput = {
  supplierId: number; receivedAt: string; note: string | null
  items: { productId: number; lotCode: string; manufacturedOn: string | null; expiresOn: string; quantityReceived: number; quantityAccepted: number; unitCost: number }[]
}

export const receiptCode = (receipt: Pick<PurchaseReceipt, 'id'>) => `PN-${String(receipt.id).padStart(5, '0')}`
/** Giá trị nhập tính theo số lượng nhận vào kho (phần bị loại không tính). */
export const receiptTotal = (receipt: Pick<PurchaseReceipt, 'items'>) => receipt.items.reduce((sum, item) => sum + item.quantityAccepted * item.unitCost, 0)

export const inventoryApi = {
  stock: () => api.get<ProductStock[]>('/inventory/stock'),
  receipts: () => api.get<PurchaseReceipt[]>('/purchase-receipts'),
  receipt: (id: number) => api.get<PurchaseReceipt>(`/purchase-receipts/${id}`),
  createReceipt: (input: ReceiptInput) => api.post<PurchaseReceipt>('/purchase-receipts', input),
  updateReceipt: (id: number, input: ReceiptInput) => api.put<PurchaseReceipt>(`/purchase-receipts/${id}`, input),
  confirmReceipt: (id: number) => api.post<PurchaseReceipt>(`/purchase-receipts/${id}/confirm`),
  cancelReceipt: (id: number) => api.post<PurchaseReceipt>(`/purchase-receipts/${id}/cancel`),
}
