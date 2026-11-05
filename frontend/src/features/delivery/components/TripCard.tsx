import { Button, Card, Progress } from 'antd'
import { Truck } from 'lucide-react'
import type { TripViewStatus } from '../tripFocus'
import { TripStatusTag } from './TripStatusTag'

type TripCardProps = {
  code: string
  status: TripViewStatus
  driver: string
  vehicle?: string | null
  finished: number
  total: number
  dueLabel: string
  onOpen: () => void
}

/** Thẻ chuyến dùng chung cho bản dùng thử và tài khoản thật. */
export function TripCard({ code, status, driver, vehicle, finished, total, dueLabel, onOpen }: TripCardProps) {
  const needsSettling = status === 'Chờ đối soát'
  return (
    <Card size="small" className="af-trip-card" hoverable onClick={onOpen}>
      <div className="af-trip-card-head">
        <strong>{code}</strong>
        <TripStatusTag status={status} />
      </div>
      <div className="af-delivery-line">
        <Truck size={14} /> {driver}
        {vehicle ? ` · ${vehicle}` : ''}
      </div>
      <Progress percent={Math.round((finished / Math.max(1, total)) * 100)} size="small" format={() => `${finished}/${total}`} />
      <div className="af-trip-card-foot">
        <small>{dueLabel}</small>
        <Button size="small" type={needsSettling ? 'primary' : 'default'}>
          {needsSettling ? 'Đối soát' : 'Chi tiết'}
        </Button>
      </div>
    </Card>
  )
}
