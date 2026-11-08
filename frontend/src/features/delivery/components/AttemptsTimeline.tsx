import { Timeline } from 'antd'
import type { DeliveryAttempt } from '../deliveryApi'

/** Các lần giao của một đơn, dùng chung cho quản lý và tài xế. */
export function AttemptsTimeline({ attempts }: { attempts: DeliveryAttempt[] }) {
  return (
    <Timeline
      items={attempts.map((attempt) => ({
        key: attempt.id,
        color: attempt.outcome === 'SUCCESS' ? 'green' : 'red',
        content: (
          <div>
            <strong>
              Lần {attempt.attemptNo} · {attempt.outcome === 'SUCCESS' ? 'Giao thành công' : 'Giao thất bại'}
            </strong>
            <p>{new Date(attempt.attemptedAt).toLocaleString('vi-VN')}</p>
            {attempt.recipientName && <p>Người nhận: {attempt.recipientName}</p>}
            {attempt.failureReason && <p>Lý do: {attempt.failureReason}</p>}
            {attempt.note && <p>Ghi chú: {attempt.note}</p>}
          </div>
        ),
      }))}
    />
  )
}
