import { useQuery } from '@tanstack/react-query'
import { api } from './client'

/** Khớp với HealthController.HealthResponse ở backend. */
export type HealthResponse = {
  status: string
  message: string
  version: string
  timestamp: string
}

export const getHealth = () => api.get<HealthResponse>('/health')

/** true: backend đang chạy · false: không kết nối được (đang dùng dữ liệu mẫu) · undefined: đang kiểm tra. */
export function useApiOnline() {
  const { data, isError } = useQuery({ queryKey: ['health'], queryFn: getHealth, retry: false, staleTime: 60_000 })
  if (isError) return false
  return data ? data.status === 'UP' : undefined
}
