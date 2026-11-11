import { useQuery } from '@tanstack/react-query'
import { useIsDemo } from '@/shared/features'
import { DEPOSIT_PER_BOTTLE } from '@/shared/policy'
import { currency } from '@/shared/utils/format'
import type { Order } from '@/features/orders/types'
import { bottleTypeApi } from './bottleTypeApi'
import { catalogApi } from './catalogApi'
import { demoBottleTypeApi } from './demoBottleTypeApi'

/** Tiền cọc mỗi vỏ của một loại vỏ đang lưu hành (BottleTypeController). */
export type DepositRate = { bottleTypeId: number; name: string; amount: number }

/** Mức cọc theo loại vỏ; bản dùng thử lấy danh mục loại vỏ mẫu. */
export function useBottleDepositRates() {
  const demo = useIsDemo()
  return useQuery({
    queryKey: ['live', 'bottle-deposit-rates', demo],
    queryFn: async (): Promise<DepositRate[]> =>
      (await (demo ? demoBottleTypeApi : bottleTypeApi).list(true)).map((type) => ({
        bottleTypeId: type.id,
        name: type.name,
        amount: Number(type.depositUnitAmount),
      })),
    staleTime: 5 * 60_000,
  })
}

/** Ghi mức cọc của các loại vỏ, ví dụ "Vỏ 20L 50.000 ₫ · Vỏ 10L 30.000 ₫". */
export const depositRatesLabel = (rates: Pick<DepositRate, 'name' | 'amount'>[]) =>
  rates.map((rate) => `${rate.name} ${currency(rate.amount)}`).join(' · ')

/**
 * Mức cọc in trên phiếu giao cho từng đơn: theo loại vỏ của các sản phẩm dạng bình trong đơn.
 * Gọi trước khi in để dữ liệu đã có sẵn; chưa xác định được loại vỏ thì trả `undefined` (phiếu để trống số tiền).
 */
export function useOrderDepositLabel() {
  const demo = useIsDemo()
  const rates = useBottleDepositRates()
  const catalog = useQuery({ queryKey: ['live', 'catalog'], queryFn: catalogApi.products, enabled: !demo })
  return (order: Pick<Order, 'lines'>): string | undefined => {
    // Bản dùng thử chưa gắn loại vỏ cho sản phẩm mẫu: dùng mức cọc mẫu.
    if (demo) return `${currency(DEPOSIT_PER_BOTTLE)}/vỏ thiếu`
    const typeIds = new Set(
      order.lines
        .filter((line) => line.unit === 'Bình')
        .map((line) => catalog.data?.find((product) => String(product.id) === line.productId)?.bottleTypeId)
        .filter((id): id is number => typeof id === 'number'),
    )
    const used = (rates.data ?? []).filter((rate) => typeIds.has(rate.bottleTypeId))
    return used.length ? `${depositRatesLabel(used)}/vỏ thiếu` : undefined
  }
}
