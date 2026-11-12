import { useId, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Badge, Button, Empty, Popover, Spin } from 'antd'
import {
  ArrowRight,
  Bell,
  CalendarClock,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClockAlert,
  Package,
  PackageX,
  TriangleAlert,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/features/auth/useAuth'
import { Link, useNavigate } from 'react-router'
import { OrderDetails } from '@/features/orders/components/OrderDetails'
import { notificationService, type Notification } from './notificationService'
import { groupNotifications, notificationTime, notificationView } from './notificationView'

const kindIcons: Record<Notification['kind'], LucideIcon> = {
  DELIVERY_FAILED: TriangleAlert,
  BATCH_EXPIRED: PackageX,
  ORDER_OVERDUE: ClockAlert,
  ORDER_PENDING: ClipboardCheck,
  LOW_STOCK: Package,
  BATCH_EXPIRING: CalendarClock,
  MANUAL: Bell,
}

/** Hộp thông báo của nhân viên. */
export function LiveNotificationPopover() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(0)
  const [orderId, setOrderId] = useState<string | null>(null)
  const navigate = useNavigate()
  const panelId = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLElement>(null)
  const client = useQueryClient()
  const key = ['notifications', user?.email] as const
  const list = useQuery({
    queryKey: [...key, 'list', page],
    queryFn: () => notificationService.list(page),
    enabled: open && !!user,
    refetchInterval: 30_000,
  })
  const unread = useQuery({
    queryKey: [...key, 'unread'],
    queryFn: notificationService.unreadCount,
    enabled: !!user,
    refetchInterval: 30_000,
  })
  const items = list.data ?? []
  const loading = list.isPending
  const failed = list.isError || unread.isError
  const read = useMutation({
    mutationFn: async (id: number | null) => {
      if (id === null) await notificationService.markAllRead()
      else await notificationService.markRead(id)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: key }),
  })
  /** Server trả đủ 20 dòng thì có thể còn trang sau. */
  const hasNextPage = !list.isError && (list.data?.length ?? 0) >= 20
  const count = unread.data?.count ?? 0
  const close = () => {
    setOpen(false)
    trigger.current?.focus()
  }
  /** Mở đúng chỗ xử lý: chi tiết đơn hoặc trang kho; mở rồi thì tính là đã đọc. */
  const openItem = (item: Notification) => {
    if (!item.readAt) read.mutate(item.id)
    if (item.entityType === 'ORDER' && item.entityId) {
      close()
      setOrderId(String(item.entityId))
    } else if (item.entityType === 'PRODUCT' || item.entityType === 'BATCH') {
      close()
      navigate('/inventory')
    }
  }

  return (
    <>
      <Popover
        trigger="click"
        placement="bottomRight"
        open={open}
        onOpenChange={setOpen}
        afterOpenChange={(visible) => visible && panel.current?.focus()}
        styles={{ container: { padding: 0 } }}
        content={
          <section
            ref={panel}
            id={panelId}
            className="af-notifications"
            role="dialog"
            aria-label="Thông báo"
            tabIndex={-1}
            onKeyDown={(event) => {
              if (event.key === 'Escape') close()
            }}
          >
            <div className="af-notifications-header">
              <strong>
                Thông báo
                {unread.isSuccess && count > 0 && (
                  <span className="af-count is-urgent" aria-label={`${count} chưa đọc`}>
                    {count}
                  </span>
                )}
              </strong>
              <span className="af-notifications-header-actions">
                <Button
                  type="text"
                  size="small"
                  icon={<CheckCheck size={15} />}
                  disabled={!count || read.isPending || unread.isError}
                  onClick={() => read.mutate(null)}
                >
                  Đọc tất cả
                </Button>
                <Button type="text" size="small" icon={<X size={16} />} aria-label="Đóng thông báo" onClick={close} />
              </span>
            </div>
            {read.isError && <Alert type="error" title="Không cập nhật được trạng thái đã đọc. Vui lòng thử lại." />}
            <div className="af-notifications-list">
              {loading ? (
                <div className="af-notifications-state">
                  <Spin size="small" />
                  <span>Đang tải thông báo…</span>
                </div>
              ) : failed ? (
                <div className="af-notifications-state">
                  <span>Không tải được thông báo.</span>
                  <Button
                    size="small"
                    onClick={() => {
                      void list.refetch()
                      void unread.refetch()
                    }}
                  >
                    Thử lại
                  </Button>
                </div>
              ) : !items.length ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có thông báo" />
              ) : (
                groupNotifications(items).map((group) => (
                  <div key={group.key} role="group" aria-label={group.label}>
                    {/* Đã xử lý: chỉ cần mờ đi và có dấu tích, không cần tiêu đề. */}
                    {group.key === 'done' ? (
                      <div className="af-notifications-group" aria-hidden />
                    ) : (
                      <div className="af-notifications-group">
                        {group.label} <span>{group.items.length}</span>
                      </div>
                    )}
                    <ul>
                      {group.items.map((item) => {
                        const view = notificationView(item)
                        const Icon = item.resolvedAt ? Check : kindIcons[item.kind]
                        const unreadItem = !item.readAt && !item.resolvedAt
                        return (
                          <li
                            key={item.id}
                            className="af-notification-item"
                            data-tone={item.resolvedAt ? undefined : view.tone}
                            data-unread={unreadItem || undefined}
                            data-resolved={item.resolvedAt ? true : undefined}
                          >
                            <span className="af-notification-icon" aria-hidden>
                              <Icon size={18} />
                            </span>
                            <div className="af-notification-copy">
                              <div className="af-notification-title">
                                <strong>{item.title}</strong>
                                {unreadItem && <span className="af-notification-dot" aria-label="Chưa đọc" />}
                                <time dateTime={item.createdAt} title={new Date(item.createdAt).toLocaleString('vi-VN')}>
                                  {notificationTime(item.createdAt)}
                                </time>
                              </div>
                              <span style={{ whiteSpace: 'pre-wrap' }}>{item.message}</span>
                              {view.action ? (
                                <Button
                                  size="small"
                                  type={view.tone === 'urgent' ? 'primary' : 'default'}
                                  danger={view.tone === 'urgent'}
                                  className="af-notification-action"
                                  disabled={read.isPending}
                                  onClick={() => openItem(item)}
                                >
                                  {view.action} <ArrowRight size={14} aria-hidden />
                                </Button>
                              ) : (
                                unreadItem && (
                                  <Button
                                    size="small"
                                    type="link"
                                    className="af-notification-action"
                                    disabled={read.isPending}
                                    onClick={() => read.mutate(item.id)}
                                  >
                                    Đánh dấu đã đọc
                                  </Button>
                                )
                              )}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))
              )}
            </div>
            <div className="af-notifications-footer">
              <Link to="/orders" onClick={() => setOpen(false)}>
                Xem tất cả đơn hàng <ArrowRight size={14} aria-hidden />
              </Link>
              {/* Chỉ một trang thì không cần nút chuyển trang. */}
              {(page > 0 || hasNextPage) && (
                <nav className="af-notifications-pager" aria-label="Trang thông báo">
                  <Button
                    type="text"
                    size="small"
                    icon={<ChevronLeft size={16} />}
                    aria-label="Trang trước"
                    disabled={page === 0 || list.isFetching}
                    onClick={() => setPage((value) => value - 1)}
                  />
                  <span aria-current="page">{page + 1}</span>
                  <Button
                    type="text"
                    size="small"
                    icon={<ChevronRight size={16} />}
                    aria-label="Trang sau"
                    disabled={!hasNextPage || list.isFetching}
                    onClick={() => setPage((value) => value + 1)}
                  />
                </nav>
              )}
            </div>
          </section>
        }
      >
        <button
          ref={trigger}
          type="button"
          className="af-notification-link"
          aria-label={unread.isError ? 'Thông báo, không tải được số chưa đọc' : `Thông báo, ${count} chưa đọc`}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
        >
          <Badge dot={count > 0 || unread.isError} offset={[-3, 3]} color={unread.isError ? 'red' : 'var(--af-warning)'}>
            <Bell size={19} aria-hidden />
          </Badge>
        </button>
      </Popover>
      {orderId !== null && <OrderDetails id={orderId} onClose={() => setOrderId(null)} />}
    </>
  )
}
