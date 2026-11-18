import { useQuery } from '@tanstack/react-query'
import { isStaff } from '@/features/auth/accountAccess'
import { useAuth } from '@/features/auth/useAuth'
import { useStaff } from '@/features/auth/useStaff'
import { orderDeliveryHistory } from './orderDeliveryApi'

/** Các chuyến của đơn; chỉ nhân viên văn phòng mới được gọi. */
export function useOrderDeliveryHistory(orderId: number) {
  const { user } = useAuth()
  const staff = useStaff()
  const allowed = isStaff(user) && (staff?.role === 'ADMIN' || staff?.role === 'SALES_STAFF')
  const query = useQuery({
    queryKey: ['live', 'order-delivery-history', user?.email, staff?.role, orderId],
    queryFn: () => orderDeliveryHistory(orderId),
    enabled: allowed,
    refetchInterval: 15000,
  })
  return { allowed, query }
}
