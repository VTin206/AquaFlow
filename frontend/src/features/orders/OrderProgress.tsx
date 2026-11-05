import { Alert, Steps, Tag } from 'antd'
import { orderStatusLabels, type LiveOrder } from '@/features/live/orderApi'
import { progressSteps } from './orderProgressSteps'

export function OrderProgress({ order }: { order: Pick<LiveOrder, 'status' | 'fulfillmentType'> }) {
  if (order.status === 'CANCELLED') return <Alert showIcon type="warning" title="Đơn hàng đã hủy" />
  const { states, current } = progressSteps(order)
  return (
    <div style={{ marginBottom: 20 }}>
      <Tag color={['DELIVERED', 'COMPLETED'].includes(order.status) ? 'green' : 'blue'}>{orderStatusLabels[order.status]}</Tag>
      <Steps
        size="small"
        current={current}
        status={['DELIVERED', 'COMPLETED'].includes(order.status) ? 'finish' : 'process'}
        items={states.map((state) => ({
          title: state === 'DELIVERED' && order.fulfillmentType === 'COUNTER' ? 'Đã nhận hàng' : orderStatusLabels[state],
        }))}
      />
    </div>
  )
}
