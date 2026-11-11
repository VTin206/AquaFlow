import dayjs from 'dayjs'
import { describe, expect, it } from 'vitest'
import type { Notification } from './notificationService'
import { groupNotifications, notificationTime, notificationView } from './notificationView'

const item = (id: number, kind: Notification['kind'], createdAt: string, extra: Partial<Notification> = {}) =>
  ({ id, kind, createdAt, entityType: 'ORDER', resolvedAt: null, ...extra }) as const

describe('notificationView', () => {
  it('gives each kind an action and drops it once resolved', () => {
    expect(notificationView(item(1, 'DELIVERY_FAILED', '2026-11-11'))).toEqual({ tone: 'urgent', action: 'Xem lý do, giao lại' })
    expect(notificationView(item(2, 'LOW_STOCK', '2026-11-11'))).toEqual({ tone: 'soon', action: 'Nhập thêm hàng' })
    expect(notificationView(item(3, 'MANUAL', '2026-11-11'))).toEqual({ tone: 'info', action: 'Xem đơn' })
    expect(notificationView(item(4, 'MANUAL', '2026-11-11', { entityType: null })).action).toBeUndefined()
    expect(notificationView(item(5, 'ORDER_PENDING', '2026-11-11', { resolvedAt: '2026-11-11' })).action).toBeUndefined()
  })

  it('puts urgent work first, then other news, then resolved', () => {
    const groups = groupNotifications([
      item(1, 'ORDER_PENDING', '2026-11-11T10:00:00'),
      item(2, 'MANUAL', '2026-11-11T11:00:00'),
      item(3, 'DELIVERY_FAILED', '2026-11-11T08:00:00'),
      item(4, 'LOW_STOCK', '2026-11-11T12:00:00'),
      item(5, 'ORDER_OVERDUE', '2026-11-11T09:00:00', { resolvedAt: '2026-11-11T09:30:00' }),
    ])
    expect(groups.map((group) => [group.key, group.items.map((entry) => entry.id)])).toEqual([
      ['todo', [3, 4, 1]],
      ['other', [2]],
      ['done', [5]],
    ])
  })

  it('formats time relative to now', () => {
    const now = dayjs('2026-11-11T15:00:00')
    expect(notificationTime('2026-11-11T14:55:00', now)).toBe('5 phút trước')
    expect(notificationTime('2026-11-11T12:00:00', now)).toBe('3 giờ trước')
    expect(notificationTime('2026-11-10T14:20:00', now)).toBe('Hôm qua 14:20')
    expect(notificationTime('2026-11-08T09:00:00', now)).toBe('08/11 09:00')
  })
})
