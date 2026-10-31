import { useId, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Badge, Button, Empty, Popover, Spin } from 'antd'
import { Bell, Check, X } from 'lucide-react'
import { useAuth } from '@/features/auth/useAuth'
import { useNavigate } from 'react-router'
import { LiveOrderDetails } from '@/features/live/LiveOrderDetails'
import { notificationService } from './notificationService'

export function LiveNotificationPopover() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(0)
  const [orderId, setOrderId] = useState<number | null>(null)
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
  const read = useMutation({
    mutationFn: async (id: number | null) => {
      if (id === null) await notificationService.markAllRead()
      else await notificationService.markRead(id)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: key }),
  })
  const count = unread.data?.count ?? 0
  const close = () => {
    setOpen(false)
    trigger.current?.focus()
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
              <strong>Thông báo {unread.isSuccess && <span>({count} chưa đọc)</span>}</strong>
              <Button type="text" size="small" icon={<X size={16} />} aria-label="Đóng thông báo" onClick={close} />
            </div>
            {read.isError && <Alert type="error" title="Không cập nhật được trạng thái đã đọc. Vui lòng thử lại." />}
            <div className="af-notifications-list">
              {list.isPending ? (
                <div className="af-notifications-state">
                  <Spin size="small" />
                  <span>Đang tải thông báo…</span>
                </div>
              ) : list.isError || unread.isError ? (
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
              ) : !list.data.length ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có thông báo" />
              ) : (
                <ul>
                  {list.data.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="af-notification-item"
                        disabled={read.isPending}
                        aria-label={`${item.title} — ${item.entityType === 'ORDER' ? 'xem đơn hàng' : item.entityType ? 'xem kho' : 'đánh dấu đã đọc'}`}
                        onClick={() => {
                          if (!item.readAt) read.mutate(item.id)
                          if (item.entityType === 'ORDER' && item.entityId) {
                            close()
                            setOrderId(item.entityId)
                          } else if (item.entityType === 'PRODUCT' || item.entityType === 'BATCH') {
                            close()
                            navigate('/inventory')
                          }
                        }}
                      >
                        <span className="af-notification-icon">
                          {item.readAt || item.resolvedAt ? <Check size={18} /> : <Bell size={18} />}
                        </span>
                        <span className="af-notification-copy">
                          <strong>{item.title}</strong>
                          <span style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{item.message}</span>
                          <small>
                            {new Date(item.createdAt).toLocaleString('vi-VN')} ·{' '}
                            {item.resolvedAt ? 'Không còn cần xử lý' : item.readAt ? 'Đã đọc' : 'Chưa đọc'}
                          </small>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="af-notifications-footer" style={{ gap: 8, flexWrap: 'wrap' }}>
              <Button size="small" disabled={!count || read.isPending || unread.isError} onClick={() => read.mutate(null)}>
                Đọc tất cả
              </Button>
              <Button size="small" disabled={page === 0 || list.isFetching} onClick={() => setPage((value) => value - 1)}>
                Trước
              </Button>
              <span>Trang {page + 1}</span>
              <Button
                size="small"
                disabled={list.isFetching || list.isError || (list.data?.length ?? 0) < 20}
                onClick={() => setPage((value) => value + 1)}
              >
                Sau
              </Button>
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
      {orderId !== null && <LiveOrderDetails id={orderId} onClose={() => setOrderId(null)} />}
    </>
  )
}
