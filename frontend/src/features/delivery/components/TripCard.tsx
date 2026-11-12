import { Button, Card, Progress } from 'antd'
import { Truck } from 'lucide-react'
import { ViewButton } from '@/shared/components/ViewButton'
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

/** Thẻ một chuyến giao. */
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
        {needsSettling ? (
          <Button size="small" type="primary">
            Đối soát
          </Button>
        ) : (
          <ViewButton subject={`chuyến ${code}`} />
        )}
      </div>
    </Card>
  )
}
