import { useState } from 'react'
import { Segmented } from 'antd'
import { Page } from '@/shared/components/Page'
import { useIsDemo } from '@/shared/features'
import { DeliveryBoard } from './components/DeliveryBoard'
import { TripsPanel } from './components/TripsPanel'

/** Một giao diện cho cả bản dùng thử và tài khoản thật; `key` tải lại phần chuyến khi đổi nguồn dữ liệu. */
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
      {view === 'board' ? <DeliveryBoard /> : <TripsPanel key={demo ? 'demo' : 'live'} />}
    </Page>
  )
}
