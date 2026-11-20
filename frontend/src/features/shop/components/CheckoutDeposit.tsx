import { useQuery } from '@tanstack/react-query'
import { bottleTypeApi } from '@/features/live/bottleTypeApi'
import type { CheckoutLine } from './CheckoutReview'

/**
 * Cọc vỏ dự kiến khi khách chưa có vỏ để đổi: số vỏ × giá cọc của từng loại vỏ.
 * Chỉ là số ước tính để hiện trên trang đặt hàng; cửa hàng chốt khi xác nhận đơn và tài xế thu khi giao.
 * - `none`: giỏ không có sản phẩm đổi vỏ.
 * - `partial`: có loại vỏ chưa có giá cọc, không cộng số có thể sai.
 */
export type ShellDeposit = {
  count: number
  status: 'none' | 'loading' | 'error' | 'partial' | 'ready'
  amount?: number
  refetch: () => void
}

export function useShellDeposit(lines: CheckoutLine[], enabled = true): ShellDeposit {
  const quantities = new Map<number, number>()
  for (const line of lines) {
    const id = line.product?.bottleTypeId
    if (id != null && Number.isSafeInteger(line.quantity) && line.quantity > 0)
      quantities.set(id, (quantities.get(id) ?? 0) + line.quantity)
  }
  const count = [...quantities.values()].reduce((sum, quantity) => sum + quantity, 0)
  const rates = useQuery({
    queryKey: ['shop', 'bottle-deposit-rates', 'live'],
    queryFn: () => bottleTypeApi.list(true),
    enabled: enabled && quantities.size > 0,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: 30000,
  })
  const refetch = () => void rates.refetch()
  if (quantities.size === 0) return { count, status: 'none', refetch }
  if (rates.isError) return { count, status: 'error', refetch }
  if (!rates.data) return { count, status: 'loading', refetch }
  let amount = 0
  for (const [id, quantity] of quantities) {
    const rate = Number(rates.data.find((type) => type.id === id && type.active)?.depositUnitAmount)
    if (!Number.isFinite(rate) || rate < 0) return { count, status: 'partial', refetch }
    amount += rate * quantity
  }
  return { count, status: 'ready', amount, refetch }
}
