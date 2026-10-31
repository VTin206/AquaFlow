import { useEffect, useId, useRef, useState } from 'react'
import { Badge, Button, Empty, Popover, Spin } from 'antd'
import { Bell, ChevronRight, ClipboardList, Clock3, Truck, X } from 'lucide-react'
import { Link } from 'react-router'
import { isOverdue } from '@/features/orders/types'
import { useOrders } from '@/features/orders/useOrders'
import { OrderDetailsModal } from '@/features/orders/components/OrderDetailsModal'

/** Các thông báo cần xử lý, suy ra từ dữ liệu đơn hàng hiện có. */
export function NotificationPopover() {
  const [open, setOpen] = useState(false)
  const [orderId, setOrderId] = useState<string | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const panelId = useId()
  const { data: orders = [], isPending, isError, refetch } = useOrders()
  // Đơn chờ xác nhận, giao thất bại, hoặc đã quá giờ hẹn mà chưa giao.
  const notifications = orders.filter((order) => ['Chờ xác nhận', 'Giao thất bại'].includes(order.status) || isOverdue(order))

  function close() {
    setOpen(false)
    triggerRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <>
      <Popover
        trigger="click"
        placement="bottomRight"
        align={{ overflow: { shiftX: true, adjustX: true, adjustY: true } }}
        open={open}
        onOpenChange={setOpen}
        afterOpenChange={(visible) => {
          if (visible) panelRef.current?.focus()
        }}
        styles={{ container: { padding: 0 } }}
        content={
          <section id={panelId} ref={panelRef} role="dialog" aria-label="Thông báo" tabIndex={-1} className="af-notifications">
            <div className="af-notifications-header">
              <strong>
                Thông báo <span>({notifications.length})</span>
              </strong>
              <Button type="text" size="small" icon={<X size={16} />} aria-label="Đóng thông báo" onClick={close} />
            </div>
            <div className="af-notifications-list">
              {isPending ? (
                <div className="af-notifications-state">
                  <Spin size="small" />
                  <span>Đang tải thông báo…</span>
                </div>
              ) : isError ? (
                <div className="af-notifications-state">
                  <span>Không tải được thông báo.</span>
                  <Button size="small" onClick={() => void refetch()}>
                    Thử lại
                  </Button>
                </div>
              ) : notifications.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có thông báo cần xử lý" />
              ) : (
                <ul>
                  {notifications.map((order) => (
                    <li key={order.id}>
                      <button
                        type="button"
                        className="af-notification-item"
                        onClick={() => {
                          setOpen(false)
                          setOrderId(order.id)
                        }}
                      >
                        <span
                          className={`af-notification-icon${order.status === 'Giao thất bại' || isOverdue(order) ? ' af-notification-icon-danger' : ''}`}
                        >
                          {order.status === 'Chờ xác nhận' ? (
                            <ClipboardList size={18} />
                          ) : isOverdue(order) && order.status !== 'Giao thất bại' ? (
                            <Clock3 size={18} />
                          ) : (
                            <Truck size={18} />
                          )}
                        </span>
                        <span className="af-notification-copy">
                          <strong>
                            {order.status === 'Giao thất bại'
                              ? 'Đơn giao thất bại'
                              : order.status === 'Chờ xác nhận'
                                ? 'Đơn hàng chờ xác nhận'
                                : 'Đơn đã quá giờ hẹn'}
                          </strong>
                          <span>
                            {order.id} · {order.customer}
                          </span>
                          <small>{order.time}</small>
                        </span>
                        <ChevronRight size={16} className="af-notification-arrow" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Link to="/orders" className="af-notifications-footer" onClick={() => setOpen(false)}>
              Xem tất cả đơn hàng <ChevronRight size={15} />
            </Link>
          </section>
        }
      >
        <button
          ref={triggerRef}
          type="button"
          className="af-notification-link"
          aria-label={`Thông báo, ${notifications.length} đơn cần xử lý`}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
        >
          <Badge dot={notifications.length > 0} offset={[-3, 3]} color="var(--af-warning)" style={{ color: 'inherit' }}>
            <Bell size={19} aria-hidden />
          </Badge>
        </button>
      </Popover>
      {orderId && (
        <OrderDetailsModal
          orderId={orderId}
          onClose={() => {
            setOrderId(null)
            triggerRef.current?.focus()
          }}
        />
      )}
    </>
  )
}
