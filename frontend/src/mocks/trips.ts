import type { TripRecord } from '../features/delivery/types'
import { initialOrders } from './data'

// Một chuyến mẫu đang chạy, gồm các đơn giao tận nơi đang ở trạng thái "Đang giao".
export const initialTrips: TripRecord[] = [
  {
    id: 'CG-001',
    driver: 'Trần Văn Tài',
    vehicle: '59-X1 234.56',
    orderIds: initialOrders
      .filter((order) => order.status === 'Đang giao' && order.method === 'Giao tận nơi')
      .map((order) => order.id)
      .slice(0, 3),
    createdAt: '2026-10-16T10:20:00+07:00',
    departedAt: '2026-10-16T10:30:00+07:00',
  },
]
