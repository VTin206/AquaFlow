import { Alert, Descriptions, Empty, Skeleton, Tag, Timeline } from 'antd'
import { Link } from 'react-router'
import { QueryError } from '@/shared/components/QueryError'
import { tripLabels } from '@/features/delivery/deliveryApi'
import { useOrderDeliveryHistory } from './useOrderDeliveryHistory'

const time = (value: string | null) => (value ? new Date(value).toLocaleString('vi-VN') : null)

/** Các chuyến và lần giao của đơn, hiển thị trong mục "Giao hàng" đang gập của chi tiết đơn. */
export function OrderDeliveryHistory({ orderId }: { orderId: number }) {
  const { allowed, query } = useOrderDeliveryHistory(orderId)
  if (!allowed) return null
  if (query.isError) return <QueryError error={query.error} onRetry={query.refetch} />
  if (query.isPending) return <Skeleton active />
  if (!query.data.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Đơn chưa được phân vào chuyến giao." />
  return (
    <div className="af-order-trips">
      {query.data.map(({ trip, assignment, attempts }) => {
        const facts = [
          { key: 'driver', label: 'Nhân viên giao hàng', children: trip.driverName ?? 'Chưa phân công' },
          { key: 'vehicle', label: 'Xe', children: trip.vehicle },
          { key: 'started', label: 'Khởi hành', children: time(trip.startedAt) },
          { key: 'ended', label: 'Kết thúc chuyến', children: time(trip.endedAt) },
        ].filter((item) => item.children)
        return (
          <article key={assignment.id}>
            <header>
              <strong>Chuyến #{trip.id}</strong>
              <Tag>{tripLabels[trip.status]}</Tag>
              <Link to={`/delivery?tripId=${trip.id}`}>Xem chuyến</Link>
            </header>
            <Descriptions size="small" column={{ xs: 1, sm: 2 }} items={facts} />
            {assignment.latestAttempt?.outcome === 'FAILED' && (
              <Alert
                type="warning"
                showIcon
                title="Lần giao gần nhất thất bại"
                description={assignment.latestAttempt.failureReason}
                style={{ marginBottom: 12 }}
              />
            )}
            {attempts.length > 0 && (
              <Timeline
                items={attempts.map((attempt) => ({
                  key: attempt.id,
                  color: attempt.outcome === 'SUCCESS' ? 'green' : 'red',
                  content: (
                    <div>
                      <strong>
                        Lần {attempt.attemptNo} · {attempt.outcome === 'SUCCESS' ? 'Giao thành công' : 'Giao thất bại'}
                      </strong>
                      <p>{time(attempt.attemptedAt)}</p>
                      {attempt.recipientName && <p>Người nhận: {attempt.recipientName}</p>}
                      {attempt.failureReason && <p>Lý do: {attempt.failureReason}</p>}
                      {attempt.note && <p>Ghi chú: {attempt.note}</p>}
                    </div>
                  ),
                }))}
              />
            )}
          </article>
        )
      })}
    </div>
  )
}
