import type { Page } from '@/shared/api/page'
import { api } from '@/shared/api/client'

/** DTO theo StockController/PurchaseReceiptController (BE2). */
export type BatchStock = {
  batchId: number
  lotCode: string
  expiresOn: string
  expired: boolean
  onHand: number
  reserved: number
  available: number
}
export type ProductStock = {
  productId: number
  sku: string
  productName: string
  onHand: number
  reserved: number
  available: number
  expiredOnHand: number
  batches: BatchStock[]
}

export type ReceiptStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED'

export type ReceiptItem = {
  id: number
  productId: number
  productName: string
  batchId: number
  lotCode: string
  manufacturedOn: string | null
  expiresOn: string
  quantityReceived: number
  quantityAccepted: number
  quantityRejected: number
  unitCost: number
}
export type PurchaseReceipt = {
  id: number
  supplierId: number
  supplierName: string
  status: ReceiptStatus
  receivedAt: string
  createdBy: number | null
  confirmedBy: number | null
  confirmedAt: string | null
  note: string | null
  items: ReceiptItem[]
  /** Người kiểm nhận hàng tại kho; null với phiếu cũ chưa ghi. */
  receiverName?: string | null
}
export type ReceiptInput = {
  supplierId: number
  receivedAt: string
  note: string | null
  receiverName: string | null
  items: {
    productId: number
    lotCode: string
    manufacturedOn: string | null
    expiresOn: string
    quantityReceived: number
    quantityAccepted: number
    unitCost: number
  }[]
}

/** Một trang phiếu nhập; `statusCounts` đếm trên toàn bộ phiếu, không theo bộ lọc. */
export type PurchaseReceiptPage = Page<PurchaseReceipt> & { statusCounts: Record<ReceiptStatus, number> }
/** Nguồn nhập của một lô: phiếu đầu tiên, ngày sản xuất, tổng số đạt đã nhập và giá vốn đầu tiên. */
export type LotSource = {
  batchId: number
  receiptId: number
  receivedAt: string
  manufacturedOn: string | null
  received: number
  unitCost: number
}

export const receiptCode = (receipt: Pick<PurchaseReceipt, 'id'>) => `PN-${String(receipt.id).padStart(5, '0')}`

export const inventoryApi = {
  stock: () => api.get<ProductStock[]>('/inventory/stock'),
  receipts: (query: { status?: ReceiptStatus; page: number; size: number }) =>
    api.get<PurchaseReceiptPage>('/purchase-receipts', { params: query.status ? query : { page: query.page, size: query.size } }),
  lotSources: () => api.get<LotSource[]>('/purchase-receipts/lot-sources'),
  receipt: (id: number) => api.get<PurchaseReceipt>(`/purchase-receipts/${id}`),
  createReceipt: (input: ReceiptInput) => api.post<PurchaseReceipt>('/purchase-receipts', input),
  updateReceipt: (id: number, input: ReceiptInput) => api.put<PurchaseReceipt>(`/purchase-receipts/${id}`, input),
  confirmReceipt: (id: number) => api.post<PurchaseReceipt>(`/purchase-receipts/${id}/confirm`),
  cancelReceipt: (id: number) => api.post<PurchaseReceipt>(`/purchase-receipts/${id}/cancel`),
}
