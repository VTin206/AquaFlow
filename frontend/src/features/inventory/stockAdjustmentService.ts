import { api } from '@/shared/api/client'

export type StockAdjustment = {
  id: number
  code: string
  batchId: number
  lotCode: string
  productName: string
  onHandBefore: number
  countedQuantity: number
  delta: number
  reason: string
}

/** Kiểm kê một lô: gửi số đếm thực tế, backend tự tính chênh lệch và ghi sổ kho (chỉ ADMIN). */
export const stockAdjustmentService = {
  adjust: (batchId: number, countedQuantity: number, reason: string) =>
    api.post<StockAdjustment>('/inventory/adjustments', { batchId, countedQuantity, reason: reason.trim() }),
}
