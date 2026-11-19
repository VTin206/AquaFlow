import { useState } from 'react'
import { Segmented } from 'antd'
import { Page } from '@/shared/components/Page'
import { DeliveryBoard } from './components/DeliveryBoard'
import { TripsPanel } from './components/TripsPanel'
import { VehiclesPanel } from './components/VehiclesPanel'

export function DeliveryPage() {
  const [view, setView] = useState<'trips' | 'board' | 'vehicles'>('trips')
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
            { value: 'vehicles', label: 'Xe' },
          ]}
        />
      }
    >
      {view === 'board' ? <DeliveryBoard /> : view === 'vehicles' ? <VehiclesPanel /> : <TripsPanel />}
    </Page>
  )
}
