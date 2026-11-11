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
import { isOverdue, type Order } from '@/features/orders/types'
import { useOrders } from '@/features/orders/useOrders'
import { useIsDemo } from '@/shared/features'
import { notificationService, type Notification } from './notificationService'
import { groupNotifications, notificationTime, notificationView } from './notificationView'

type Item = Notification & { orderRef?: string }

const kindIcons: Record<Notification['kind'], LucideIcon> = {
  DELIVERY_FAILED: TriangleAlert,
  BATCH_EXPIRED: PackageX,
  ORDER_OVERDUE: ClockAlert,
  ORDER_PENDING: ClipboardCheck,
  LOW_STOCK: Package,
  BATCH_EXPIRING: CalendarClock,
  MANUAL: Bell,
}

/** Bản dùng thử: thông báo suy từ đơn mẫu cần xử lý; trạng thái đã đọc chỉ giữ trong phiên. */
const demoItems = (orders: Order[], read: ReadonlySet<string>): Item[] =>
  orders
    .filter((order) => ['Chờ xác nhận', 'Giao thất bại'].includes(order.status) || isOverdue(order))
    .map((order, index) => ({
      id: index + 1,
      title:
        order.status === 'Giao thất bại'
          ? 'Đơn giao thất bại'
          : order.status === 'Chờ xác nhận'
            ? 'Đơn hàng chờ xác nhận'
            : 'Đơn đã quá giờ hẹn',
      message: `${order.code ?? order.id} · ${order.customer}`,
      createdAt: order.history[0]?.at ?? new Date().toISOString(),
      readAt: read.has(order.id) ? new Date().toISOString() : null,
      resolvedAt: null,
      kind: order.status === 'Giao thất bại' ? 'DELIVERY_FAILED' : order.status === 'Chờ xác nhận' ? 'ORDER_PENDING' : 'ORDER_OVERDUE',
      entityType: 'ORDER',
      entityId: index + 1,
      orderRef: order.id,
    }))

/** Hộp thông báo dùng chung cho bản dùng thử và tài khoản thật. */
export function LiveNotificationPopover() {
  const { user } = useAuth()
  const demo = useIsDemo()
  const demoOrders = useOrders(demo)
  const [demoRead, setDemoRead] = useState<ReadonlySet<string>>(new Set())
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
    enabled: !demo && open && !!user,
    refetchInterval: 30_000,
  })
  const unread = useQuery({
    queryKey: [...key, 'unread'],
    queryFn: notificationService.unreadCount,
    enabled: !demo && !!user,
    refetchInterval: 30_000,
  })
  const items: Item[] = demo ? demoItems(demoOrders.data ?? [], demoRead) : (list.data ?? [])
  const loading = demo ? demoOrders.isPending : list.isPending
  const failed = demo ? demoOrders.isError : list.isError || unread.isError
  const read = useMutation({
    mutationFn: async (id: number | null) => {
      if (demo) {
        const refs = items.filter((item) => id === null || item.id === id).flatMap((item) => (item.orderRef ? [item.orderRef] : []))
        setDemoRead((current) => new Set([...current, ...refs]))
        return
      }
      if (id === null) await notificationService.markAllRead()
      else await notificationService.markRead(id)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: key }),
  })
  /** Server trả đủ 20 dòng thì có thể còn trang sau; bản dùng thử chỉ có một trang. */
  const hasNextPage = !demo && !list.isError && (list.data?.length ?? 0) >= 20
  const count = demo ? items.filter((item) => !item.readAt).length : (unread.data?.count ?? 0)
  const close = () => {
    setOpen(false)
    trigger.current?.focus()
  }
  /** Mở đúng chỗ xử lý: chi tiết đơn hoặc trang kho; mở rồi thì tính là đã đọc. */
  const openItem = (item: Item) => {
    if (!item.readAt) read.mutate(item.id)
    if (item.entityType === 'ORDER' && item.entityId) {
      close()
      setOrderId(item.orderRef ?? String(item.entityId))
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
                {(demo || unread.isSuccess) && count > 0 && (
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
                      if (demo) {
                        void demoOrders.refetch()
                        return
                      }
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
