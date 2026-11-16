import type { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/shared/api/client'
import { catalogApi } from './catalogApi'

/** Câu báo thiếu hàng của backend khi giữ hàng cho đơn (StockReservationService): chỉ có mã sản phẩm. */
const SHORTAGE = /^Sản phẩm (\d+) chỉ còn (\d+) có thể bán, không đủ (\d+)$/

/** Viết lại câu báo thiếu hàng bằng tên sản phẩm; câu khác giữ nguyên. */
export function stockShortageMessage(message: string, nameOf: (productId: number) => string | undefined) {
  const match = SHORTAGE.exec(message.trim())
  if (!match) return message
  const [, id, available, needed] = match
  const name = nameOf(Number(id)) ?? `Sản phẩm #${id}`
  return Number(available) === 0
    ? `Chưa xác nhận được đơn: "${name}" đã hết hàng (đơn cần ${needed}).`
    : `Chưa xác nhận được đơn: "${name}" chỉ còn ${available}, đơn cần ${needed}.`
}

/**
 * Dùng trong `.catch` của lệnh xác nhận đơn: lỗi thiếu hàng được ném lại với tên sản phẩm lấy từ danh mục
 * (cùng cache `['live', 'catalog']` với màn hình đơn hàng); không tải được danh mục thì giữ mã sản phẩm.
 */
export async function explainStockShortage(error: unknown, queryClient: QueryClient): Promise<never> {
  if (!(error instanceof Error) || !SHORTAGE.test(error.message.trim())) throw error
  const products = await queryClient
    .fetchQuery({ queryKey: ['live', 'catalog'], queryFn: catalogApi.products, staleTime: 60_000 })
    .catch(() => [])
  const message = stockShortageMessage(error.message, (id) => products.find((product) => product.id === id)?.name)
  throw error instanceof ApiError ? new ApiError(error.status, message, error.body) : new Error(message)
}
