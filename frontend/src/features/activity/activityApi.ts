import { api } from '@/shared/api/client'

export const activityAreas = { ORDERS: 'Đơn hàng', INVENTORY: 'Kho hàng', DELIVERY: 'Giao hàng', CUSTOMERS: 'Khách hàng', SUPPLIERS: 'Nhà cung cấp', SETTINGS: 'Cài đặt', OTHER: 'Khác' }
export type ActivityAreaCode = keyof typeof activityAreas
export type ActivityLog = { id: number; at: string; actorId: number | null; actorName: string; area: ActivityAreaCode; action: string; entityType: string; entityId: number | null; target: string; reason: string | null }
export type ActivityFilter = { area?: ActivityAreaCode; actorId?: number; from?: string; to?: string; q?: string; page: number; size: number }
export type ActivityPageResult = { content: ActivityLog[]; page: number; size: number; totalElements: number }
export const activityApi = {
  list: (filter: ActivityFilter) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(filter)) if (value !== undefined && value !== '') params.set(key, String(value))
    return api.get<ActivityPageResult>(`/admin/activity-logs?${params}`)
  },
  detail: (id: number) => api.get<ActivityLog>(`/admin/activity-logs/${id}`),
  actors: () => api.get<{ id: number; name: string }[]>('/admin/activity-logs/actors'),
}
export const activityDescription = (entry: ActivityLog) => entry.reason || ({ UPDATE: 'Cập nhật', CREATE: 'Tạo mới', DELETE: 'Xóa / ngừng sử dụng' }[entry.action] ?? entry.action)
export const activityTarget = (entry: ActivityLog) => {
  const labels: Record<string, string> = { ORDER: 'Đơn hàng', DISPATCH: 'Phiếu xuất', INVENTORY_RETURN: 'Phiếu hoàn', PRODUCT: 'Sản phẩm', BOTTLE_TYPE: 'Loại vỏ', PURCHASE_RECEIPT: 'Phiếu nhập', SUPPLIER: 'Nhà cung cấp', CUSTOMER: 'Khách hàng', CUSTOMER_ADDRESS: 'Địa chỉ khách', DELIVERY_TRIP: 'Chuyến giao', STORE_SETTINGS: 'Cài đặt cửa hàng' }
  return entry.target.startsWith(entry.entityType) ? `${labels[entry.entityType] ?? 'Đối tượng'}${entry.entityId === null ? '' : ` #${entry.entityId}`}` : entry.target
}
export const csvSafeCell = (value: string) => /^[\s]*[=+@-]/.test(value) || /^[\t\r\n]/.test(value) ? `'${value}` : value
