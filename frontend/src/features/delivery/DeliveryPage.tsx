import { useState } from 'react'
import { Segmented } from 'antd'
import { Page } from '@/shared/components/Page'
import { useIsDemo } from '@/shared/features'
import { DeliveryBoard } from './components/DeliveryBoard'
import { LiveTripsPanel } from './components/LiveTripsPanel'
import { TripsPanel } from './components/TripsPanel'

/** Một giao diện cho cả bản dùng thử và tài khoản thật; chỉ khác nguồn dữ liệu của phần chuyến. */
export function DeliveryPage() {
  const demo = useIsDemo()
  const [view, setView] = useState<'trips' | 'board'>('trips')
  return (
    <Page
      title="Giao hàng"
      description="Xếp đơn vào chuyến, ghi kết quả từng điểm giao và đối soát tiền, vỏ khi tài xế về."
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
      {view === 'board' ? <DeliveryBoard /> : demo ? <TripsPanel /> : <LiveTripsPanel />}
    </Page>
  )
}
