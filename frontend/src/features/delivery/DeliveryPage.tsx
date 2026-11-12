import { useState } from 'react'
import { Segmented } from 'antd'
import { Page } from '@/shared/components/Page'
import { DeliveryBoard } from './components/DeliveryBoard'
import { TripsPanel } from './components/TripsPanel'

export function DeliveryPage() {
  const [view, setView] = useState<'trips' | 'board'>('trips')
  return (
    <Page
      title="Giao hàng"
      actions={
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'trips', label: 'Chuyến giao' },
            { value: 'board', label: 'Bảng theo dõi đơn' },
          ]}
        />
      }
    >
      {view === 'board' ? <DeliveryBoard /> : <TripsPanel />}
    </Page>
  )
}
