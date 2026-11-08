import { api } from '@/shared/api/client'

export type Notification = {
  id: number
  title: string
  message: string
  createdAt: string
  readAt: string | null
  kind: 'MANUAL' | 'ORDER_PENDING' | 'ORDER_OVERDUE' | 'DELIVERY_FAILED' | 'LOW_STOCK' | 'BATCH_EXPIRING' | 'BATCH_EXPIRED'
  entityType: 'ORDER' | 'PRODUCT' | 'BATCH' | null
  entityId: number | null
  resolvedAt: string | null
}

export const notificationService = {
  list: (page: number, size = 20) => api.get<Notification[]>('/notifications', { params: { page, size } }),
  unreadCount: () => api.get<{ count: number }>('/notifications/unread-count'),
  markRead: (id: number) => api.put<Notification>(`/notifications/${id}/read`),
  markAllRead: () => api.put<{ updated: number }>('/notifications/read-all'),
}
