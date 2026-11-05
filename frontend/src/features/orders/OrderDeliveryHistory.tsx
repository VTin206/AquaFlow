import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Card, Descriptions, Empty, Skeleton, Space, Tag, Timeline } from 'antd'
import { Link } from 'react-router'
import { useAuth } from '@/features/auth/useAuth'
import { isStaff } from '@/features/auth/accountAccess'
import { useStaff } from '@/features/auth/useStaff'
import { QueryError } from '@/shared/components/QueryError'
import { tripLabels } from '@/features/delivery/deliveryApi'
import { orderDeliveryHistory } from './orderDeliveryApi'
const time = (value: string | null) => (value ? new Date(value).toLocaleString('vi-VN') : '—')

export function OrderDeliveryHistory({ orderId }: { orderId: number }) {
  const { user } = useAuth()
  const staff = useStaff()
  const allowed = isStaff(user) && !user?.isDemo && (staff?.role === 'ADMIN' || staff?.role === 'SALES_STAFF')
  const query = useQuery({
    queryKey: ['live', 'order-delivery-history', user?.email, staff?.role, orderId],
    queryFn: () => orderDeliveryHistory(orderId),
    enabled: allowed,
    refetchInterval: 15000,
  })
  if (!allowed) return null
  return (
    <Card
      title="Tiến trình giao hàng"
      style={{ marginTop: 16 }}
      extra={
        <Button loading={query.isFetching} onClick={() => void query.refetch()}>
          Làm mới
        </Button>
      }
    >
      {query.isError ? (
        <QueryError error={query.error} onRetry={query.refetch} />
      ) : query.isPending ? (
        <Skeleton active />
      ) : !query.data.length ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Đơn chưa được phân vào chuyến giao." />
      ) : (
        query.data.map(({ trip, assignment, attempts }) => (
          <Card
            key={assignment.id}
            size="small"
            style={{ marginBottom: 12 }}
            title={
              <Space>
                Chuyến #{trip.id}
                <Tag>{tripLabels[trip.status]}</Tag>
              </Space>
            }
            extra={<Link to={`/delivery?tripId=${trip.id}`}>Xem chuyến</Link>}
          >
            <Descriptions
              size="small"
              column={{ xs: 1, sm: 2 }}
              items={[
                { key: 'driver', label: 'Nhân viên giao hàng', children: trip.driverName ?? 'Chưa phân công' },
                { key: 'vehicle', label: 'Xe', children: trip.vehicle || 'Chưa ghi nhận' },
                { key: 'created', label: 'Tạo chuyến', children: time(trip.createdAt) },
                { key: 'started', label: 'Khởi hành', children: time(trip.startedAt) },
                { key: 'ended', label: 'Kết thúc chuyến', children: time(trip.endedAt) },
              ]}
            />
            {assignment.latestAttempt?.outcome === 'FAILED' && (
              <Alert
                type="warning"
                showIcon
                title="Lần giao gần nhất thất bại"
                description={assignment.latestAttempt.failureReason}
                style={{ marginBottom: 12 }}
              />
            )}
            {!attempts.length ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có lần giao được ghi nhận." />
            ) : (
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
          </Card>
        ))
      )}
    </Card>
  )
}
