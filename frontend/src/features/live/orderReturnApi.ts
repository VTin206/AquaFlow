import { useQuery } from '@tanstack/react-query'
import { api } from '@/shared/api/client'
import { useStaff } from '@/features/auth/useStaff'
import { orderStatusLabels } from './orderApi'

/** Một lần khách trả hàng (POST/GET /sales/orders/{id}/returns). `value` đã chia theo giảm giá của đơn. */
export type OrderReturn = {
  id: number
  orderId: number
  orderCode: string
  createdAt: string
  performedBy: number
  performedByName: string
  reason: string
  restocked: boolean
  value: number
  refunded: number
  refundPaymentId: number | null
  lines: { orderItemId: number; productId: number; productName: string; quantity: number; unitPrice: number; value: number }[]
}
export type ReturnableItem = {
  orderItemId: number
  productId: number
  productName: string
  ordered: number
  returned: number
  returnable: number
  unitPrice: number
}
export type OrderReturnSummary = { returns: OrderReturn[]; items: ReturnableItem[] }
export type OrderReturnInput = {
  requestId: string
  reason: string
  /** true: hàng còn bán được, nhập lại đúng lô khách đã nhận; false: hàng hỏng, loại bỏ. */
  restock: boolean
  lines: { orderItemId: number; quantity: number }[]
  /** Bắt buộc khi khách đã trả nhiều hơn giá trị đơn sau khi trừ hàng trả; số tiền do BE tính. */
  refund?: { method: 'CASH' | 'BANK_TRANSFER'; reference?: string }
}

/** Mốc trong nhật ký của đơn: thao tác nghiệp vụ hoặc phiếu thu/hoàn tiền. */
export type OrderActivityEntry = {
  kind: 'ACTION' | 'PAYMENT'
  at: string
  actorId: number | null
  actorName: string
  action: string
  description: string | null
  entityType: string
  entityId: number | null
}

export const orderReturnApi = {
  summary: (orderId: number) => api.get<OrderReturnSummary>(`/sales/orders/${orderId}/returns`),
  create: (orderId: number, input: OrderReturnInput) => api.post<OrderReturn>(`/sales/orders/${orderId}/returns`, input),
  activity: (orderId: number) => api.get<OrderActivityEntry[]>(`/sales/orders/${orderId}/activity`),
}

const useStoreStaff = () => {
  const staff = useStaff()
  return { staff, allowed: staff?.role === 'ADMIN' || staff?.role === 'SALES_STAFF' }
}

export function useOrderReturns(orderId: number) {
  const { staff, allowed } = useStoreStaff()
  return useQuery({
    queryKey: ['live', 'order-returns', staff?.name, staff?.role, orderId],
    queryFn: () => orderReturnApi.summary(orderId),
    enabled: allowed,
  })
}

export function useOrderActivity(orderId: number, enabled: boolean) {
  const { staff, allowed } = useStoreStaff()
  return useQuery({
    queryKey: ['live', 'order-activity', staff?.name, staff?.role, orderId],
    queryFn: () => orderReturnApi.activity(orderId),
    enabled: allowed && enabled,
    refetchInterval: 15000,
  })
}

/**
 * Giá trị hàng trả như BE: số lượng × đơn giá × tỷ lệ sau giảm giá của đơn, làm tròn tới đồng.
 * Chỉ dùng để báo trước; số tiền hoàn thật do BE tính.
 */
export const returnValue = (lines: { quantity: number; unitPrice: number }[], subtotal: number, discount: number) => {
  const ratio = subtotal > 0 ? (subtotal - discount) / subtotal : 1
  return Math.round(lines.reduce((sum, line) => sum + line.quantity * line.unitPrice * ratio, 0))
}

/** Số phải hoàn sau khi nhận trả: đã thu vượt phần còn lại của đơn. `total` là tổng hiện tại (đã trừ lần trả trước). */
export const refundAfterReturn = (balance: { total: number; paid: number }, value: number) =>
  Math.max(0, Number(balance.paid) - Math.max(0, Number(balance.total) - value))

/** Nhãn thao tác trong nhật ký theo đơn; thao tác chưa có nhãn thì dùng mô tả BE ghi kèm. */
export const activityLabels: Record<string, string> = {
  paymentIn: 'Thu tiền',
  paymentOut: 'Hoàn tiền',
  receive: 'Nhận trả hàng',
}

const outcomeLabels: Record<string, string> = { FAILED: 'Giao thất bại' }

/** Mô tả một mốc, đổi mã trạng thái BE ghi kèm ("→ CONFIRMED", "· DELIVERED") sang nhãn tiếng Việt. */
export const describeActivity = (entry: Pick<OrderActivityEntry, 'action' | 'description'>) =>
  (entry.description ?? activityLabels[entry.action] ?? entry.action).replace(
    /\b[A-Z][A-Z_]{3,}\b/g,
    (code) => (orderStatusLabels as Record<string, string>)[code] ?? outcomeLabels[code] ?? code,
  )
