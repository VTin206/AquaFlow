import type { Tone } from '@/shared/components/ToneLabel'
import type { OrderStatus } from './types'

/**
 * Trang Đơn hàng gom 8 trạng thái thành 4 nhóm theo việc nhân viên cần làm.
 * "Tất cả" gồm cả đơn đã hủy; muốn xem riêng thì lọc trạng thái trong nhóm này.
 */
export const orderGroups = [
  { key: 'need', label: 'Cần xử lý', tone: 'warning', statuses: ['Chờ xác nhận', 'Giao thất bại'] },
  { key: 'active', label: 'Đang thực hiện', tone: 'info', statuses: ['Đã xác nhận', 'Đang chuẩn bị', 'Đang giao'] },
  { key: 'done', label: 'Đã xong', tone: 'success', statuses: ['Đã giao', 'Đã hoàn tất'] },
  { key: 'all', label: 'Tất cả', tone: 'neutral', statuses: null },
] as const satisfies readonly { key: string; label: string; tone: Tone; statuses: readonly OrderStatus[] | null }[]

export type OrderGroupKey = (typeof orderGroups)[number]['key']
export const orderGroupKeys: OrderGroupKey[] = orderGroups.map((group) => group.key)

export const isOrderGroup = (value: unknown): value is OrderGroupKey => orderGroupKeys.includes(value as OrderGroupKey)

const statusesOf = (group: OrderGroupKey): readonly OrderStatus[] | null => orderGroups.find((item) => item.key === group)?.statuses ?? null

export const inOrderGroup = (group: OrderGroupKey, status: OrderStatus) => statusesOf(group)?.includes(status) ?? true

/** Nhóm chứa trạng thái; dùng khi mở trang từ liên kết lọc sẵn theo trạng thái. Đơn đã hủy chỉ nằm ở "Tất cả". */
export const groupOfStatus = (status: string): OrderGroupKey =>
  orderGroups.find((group) => (group.statuses as readonly string[] | null)?.includes(status))?.key ?? 'all'

/** Trạng thái lọc được trong nhóm, theo đúng thứ tự và chỉ những trạng thái nguồn dữ liệu đang dùng. */
export const statusesInGroup = (group: OrderGroupKey, available: readonly OrderStatus[]) =>
  available.filter((status) => inOrderGroup(group, status))
