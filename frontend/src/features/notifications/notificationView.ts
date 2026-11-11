import dayjs from 'dayjs'
import type { Notification } from './notificationService'

/** Mức gấp: đỏ cần làm ngay, cam cần làm sớm, xám chỉ để biết. */
export type NotificationTone = 'urgent' | 'soon' | 'info'

type KindView = { tone: NotificationTone; action?: string }

/** Mỗi loại thông báo nói rõ việc cần làm; bấm nút mở đúng chỗ xử lý (chi tiết đơn hoặc trang kho). */
const kinds: Record<Notification['kind'], KindView> = {
  DELIVERY_FAILED: { tone: 'urgent', action: 'Xem lý do, giao lại' },
  BATCH_EXPIRED: { tone: 'urgent', action: 'Xử lý lô hết hạn' },
  ORDER_OVERDUE: { tone: 'urgent', action: 'Xem đơn, báo khách' },
  ORDER_PENDING: { tone: 'soon', action: 'Xác nhận đơn' },
  LOW_STOCK: { tone: 'soon', action: 'Nhập thêm hàng' },
  BATCH_EXPIRING: { tone: 'soon', action: 'Xem lô sắp hết hạn' },
  MANUAL: { tone: 'info' },
}

/** Thông báo thường không có việc riêng: chỉ mời mở đơn hoặc kho nếu có gắn. */
const entityAction = (entityType: Notification['entityType']) =>
  entityType === 'ORDER' ? 'Xem đơn' : entityType === 'PRODUCT' || entityType === 'BATCH' ? 'Xem kho' : undefined

export function notificationView(item: Pick<Notification, 'kind' | 'entityType' | 'resolvedAt'>) {
  const kind = kinds[item.kind] ?? kinds.MANUAL
  return {
    tone: kind.tone,
    /** Đã xử lý thì không còn việc cần làm. */
    action: item.resolvedAt ? undefined : (kind.action ?? entityAction(item.entityType)),
  }
}

export type NotificationGroup<T> = { key: 'todo' | 'other' | 'done'; label: string; items: T[] }

const toneRank: Record<NotificationTone, number> = { urgent: 0, soon: 1, info: 2 }
const newestFirst = (a: Pick<Notification, 'createdAt'>, b: Pick<Notification, 'createdAt'>) =>
  dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf()

/** Cần xử lý (gấp trước, mới trước) → tin khác → đã xử lý. Nhóm rỗng bị bỏ. */
export function groupNotifications<T extends Pick<Notification, 'kind' | 'entityType' | 'resolvedAt' | 'createdAt'>>(
  items: readonly T[],
): NotificationGroup<T>[] {
  const todo: T[] = []
  const other: T[] = []
  const done: T[] = []
  for (const item of items) {
    if (item.resolvedAt) done.push(item)
    else if (notificationView(item).tone === 'info') other.push(item)
    else todo.push(item)
  }
  todo.sort((a, b) => toneRank[notificationView(a).tone] - toneRank[notificationView(b).tone] || newestFirst(a, b))
  other.sort(newestFirst)
  done.sort(newestFirst)
  const groups: NotificationGroup<T>[] = [
    { key: 'todo', label: 'Cần xử lý', items: todo },
    { key: 'other', label: 'Thông báo khác', items: other },
    { key: 'done', label: 'Đã xử lý', items: done },
  ]
  return groups.filter((group) => group.items.length)
}

/** "Vừa xong", "5 phút trước", "3 giờ trước", "Hôm qua 14:20", "08/11 09:00". */
export function notificationTime(at: string, now = dayjs()) {
  const time = dayjs(at)
  const minutes = now.diff(time, 'minute')
  if (minutes < 1) return 'Vừa xong'
  if (minutes < 60) return `${minutes} phút trước`
  if (time.isSame(now, 'day')) return `${Math.floor(minutes / 60)} giờ trước`
  if (time.isSame(now.subtract(1, 'day'), 'day')) return `Hôm qua ${time.format('HH:mm')}`
  return time.format('DD/MM HH:mm')
}
