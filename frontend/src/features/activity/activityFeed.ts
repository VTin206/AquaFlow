import dayjs, { type Dayjs } from 'dayjs'
import { activityAreas, activityDescription, activityTarget, type ActivityLog } from './activityApi'

/** Một dòng nhật ký đã chuẩn hóa, lấy từ máy chủ. */
export type ActivityItem = {
  id: string
  at: string
  actor: string
  area: string
  description: string
  target: string
  /** Đối tượng mở được: đơn hàng mở chi tiết, các loại khác mở trang tương ứng. */
  entity?: { type: string; id: string }
  important: boolean
}

export type ActivityRange = 'today' | '7d' | '30d' | 'all' | 'custom'

/** Khoảng thời gian theo ngày giờ máy, `to` là đầu ngày hôm sau để lấy trọn ngày cuối. */
export function rangeBounds(range: ActivityRange, custom: [Dayjs, Dayjs] | null, now = dayjs()) {
  const end = now.add(1, 'day').startOf('day')
  if (range === 'today') return { from: now.startOf('day'), to: end }
  if (range === '7d') return { from: now.subtract(6, 'day').startOf('day'), to: end }
  if (range === '30d') return { from: now.subtract(29, 'day').startOf('day'), to: end }
  if (range === 'custom' && custom) return { from: custom[0].startOf('day'), to: custom[1].add(1, 'day').startOf('day') }
  return { from: undefined, to: undefined }
}

const IMPORTANT_TEXT = /hủy|hoàn \d|hoàn tiền|xóa|ngừng|lưu trữ|đối soát|(đổi|sửa|điều chỉnh|cập nhật)[^.]*giá|quyền|vai trò|khóa tài khoản/i
const IMPORTANT_ACTIONS = new Set(['DELETE', 'delete', 'archive', 'cancel', 'settle'])

/**
 * Thao tác chủ cửa hàng nên soát: hủy, xóa/ngừng, hoàn tiền, đổi giá, đối soát tiền, mọi thay đổi tài khoản nhân viên.
 * Xác nhận đơn ("chốt giá") không tính vì chỉ là bước thường ngày.
 */
export const isImportantActivity = (description: string, action?: string, entityType?: string) =>
  entityType === 'STAFF_ACCOUNT' || (action !== undefined && IMPORTANT_ACTIONS.has(action)) || IMPORTANT_TEXT.test(description)

export function fromLive(entry: ActivityLog): ActivityItem {
  const description = activityDescription(entry)
  return {
    id: String(entry.id),
    at: entry.at,
    actor: entry.actorName,
    area: activityAreas[entry.area] ?? 'Khác',
    description,
    target: activityTarget(entry),
    entity: entry.entityId === null ? undefined : { type: entry.entityType, id: String(entry.entityId) },
    important: isImportantActivity(description, entry.action, entry.entityType),
  }
}

/** Trang mở khi bấm đối tượng không phải đơn hàng (chưa có đường dẫn tới từng hồ sơ). */
export const entityPages: Record<string, { path: string; label: string }> = {
  PRODUCT: { path: '/products', label: 'Mở trang Sản phẩm' },
  BOTTLE_TYPE: { path: '/products', label: 'Mở trang Sản phẩm' },
  CUSTOMER: { path: '/customers', label: 'Mở trang Khách hàng' },
  CUSTOMER_ADDRESS: { path: '/customers', label: 'Mở trang Khách hàng' },
  SUPPLIER: { path: '/suppliers', label: 'Mở trang Nhà cung cấp' },
  PURCHASE_RECEIPT: { path: '/inventory', label: 'Mở trang Kho hàng' },
  DISPATCH: { path: '/inventory', label: 'Mở trang Kho hàng' },
  INVENTORY_RETURN: { path: '/inventory', label: 'Mở trang Kho hàng' },
  DELIVERY_TRIP: { path: '/delivery', label: 'Mở trang Giao hàng' },
  STAFF_ACCOUNT: { path: '/staff', label: 'Mở trang Nhân viên' },
}

/** Nhóm theo ngày, giữ thứ tự mới nhất trước. */
export function groupByDay(items: ActivityItem[], now = dayjs()) {
  const groups: { key: string; label: string; items: ActivityItem[] }[] = []
  for (const item of items) {
    const day = dayjs(item.at)
    const key = day.format('YYYY-MM-DD')
    let group = groups.at(-1)
    if (!group || group.key !== key) {
      group = { key, label: dayLabel(day, now), items: [] }
      groups.push(group)
    }
    group.items.push(item)
  }
  return groups
}

const weekdays = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']
export function dayLabel(day: Dayjs, now = dayjs()) {
  if (day.isSame(now, 'day')) return 'Hôm nay'
  if (day.isSame(now.subtract(1, 'day'), 'day')) return 'Hôm qua'
  return `${weekdays[day.day()]}, ${day.format('DD/MM/YYYY')}`
}

/** "5 phút trước", quá 1 ngày thì ghi giờ. */
export function relativeTime(at: string, now = dayjs()) {
  const minutes = now.diff(dayjs(at), 'minute')
  if (minutes < 1) return 'Vừa xong'
  if (minutes < 60) return `${minutes} phút trước`
  if (minutes < 24 * 60 && dayjs(at).isSame(now, 'day')) return `${Math.floor(minutes / 60)} giờ trước`
  return dayjs(at).format('HH:mm')
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((part) => /\p{L}/u.test(part))
    .slice(-2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?'
