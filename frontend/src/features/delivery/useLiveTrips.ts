import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/useAuth'
import { useStaff } from '@/features/auth/useStaff'
import { collectionApi, deliveryApi } from './deliveryApi'

const useWho = () => {
  const { user } = useAuth()
  const staff = useStaff()
  return [user?.email, staff?.role] as const
}

/** Dữ liệu giao hàng của tài khoản thật; cùng khóa nên các màn hình dùng chung một bản và cùng được làm mới. */
export function useLiveTrips(enabled = true) {
  const who = useWho()
  return useQuery({ queryKey: ['live', 'delivery-trips', ...who], queryFn: deliveryApi.list, enabled, refetchInterval: 15000 })
}

export function useLiveTrip(id: number) {
  const who = useWho()
  return useQuery({ queryKey: ['live', 'delivery-trip', ...who, id], queryFn: () => deliveryApi.detail(id), refetchInterval: 15000 })
}

export function useTripCollections(id: number) {
  const who = useWho()
  return useQuery({ queryKey: ['live', 'delivery-collections', ...who, id], queryFn: () => collectionApi.get(id), refetchInterval: 15000 })
}

export function useAvailableOrders() {
  const who = useWho()
  return useQuery({ queryKey: ['live', 'delivery-available', ...who], queryFn: deliveryApi.available, refetchInterval: 15000 })
}

export function useDeliveryDrivers(enabled = true) {
  const who = useWho()
  return useQuery({ queryKey: ['live', 'delivery-drivers', ...who], queryFn: deliveryApi.drivers, enabled })
}
