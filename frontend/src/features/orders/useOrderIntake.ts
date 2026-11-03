import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Customer } from '@/features/customers/types'
import { daysUntilExpiry } from '@/features/inventory/expiry'
import { useStockItems } from '@/features/inventory/useInventory'
import { useProducts } from '@/features/inventory/useProducts'
import { catalogApi } from '@/features/live/catalogApi'
import { customerApi } from '@/features/live/customerApi'
import { invalidateLiveData } from '@/features/live/invalidateLiveData'
import { orderApi } from '@/features/live/orderApi'
import { useIsDemo } from '@/shared/features'
import { toDemoOrderDraft, toLiveOrderInput, type IntakeValues } from './orderIntake'
import { useCreateOrder } from './useOrders'

export type IntakeProduct = {
  id: string
  sku: string
  name: string
  unit: string
  price: number
  /** Số còn bán được; chưa biết (không tải được tồn kho) thì để trống. */
  available?: number
  sellable: boolean
}
export type IntakeAddress = { line: string; area?: string; recipientName?: string; recipientPhone?: string; isDefault: boolean }

/** Sản phẩm cho form nhận đơn. Không tải được tồn kho vẫn tạo được đơn; hệ thống kiểm tra lại khi xác nhận. */
export function useIntakeProducts() {
  const demo = useIsDemo()
  const demoQuery = useProducts(demo)
  const catalog = useQuery({ queryKey: ['live', 'catalog'], queryFn: catalogApi.products, enabled: !demo })
  const stock = useStockItems(!demo)
  const query = demo ? demoQuery : catalog
  const products: IntakeProduct[] = demo
    ? (demoQuery.data ?? [])
        .filter((product) => product.sku !== 'VO-20L')
        .map((product) => ({
          id: product.id,
          sku: product.sku,
          name: product.name,
          unit: product.unit,
          price: product.price,
          available: product.stock,
          sellable: product.stock > 0 && (daysUntilExpiry(product.expiry) ?? 0) >= 0,
        }))
    : (catalog.data ?? []).map((product) => {
        const available = stock.data?.find((item) => item.id === String(product.id))?.available
        return {
          id: String(product.id),
          sku: product.sku,
          name: product.name,
          unit: product.unit,
          price: product.salePrice,
          available,
          sellable: available !== 0,
        }
      })
  return { products, isPending: query.isPending, error: query.error, refetch: query.refetch }
}

/** Địa chỉ đã lưu của khách; `undefined` là đang tải hoặc không tải được. */
export function useIntakeAddresses(customer: Customer | undefined) {
  const demo = useIsDemo()
  const customerId = customer ? Number(customer.id) : undefined
  const query = useQuery({
    queryKey: ['live', 'customer-addresses', customerId],
    queryFn: () => customerApi.addresses(customerId!),
    enabled: !demo && customerId !== undefined,
  })
  const addresses: IntakeAddress[] | undefined = demo
    ? customer?.addresses.map((line, index) => ({ line, isDefault: index === 0 }))
    : query.data?.map((address) => ({
        line: address.addressLine,
        area: address.area ?? undefined,
        recipientName: address.recipientName,
        recipientPhone: address.recipientPhone,
        isDefault: address.isDefault,
      }))
  return { addresses, isError: !demo && query.isError, refetch: query.refetch }
}

/** Tạo đơn chờ xác nhận; trả về mã để mở chi tiết và mã hiển thị. */
export function useSubmitIntake() {
  const demo = useIsDemo()
  const queryClient = useQueryClient()
  const createDemo = useCreateOrder()
  return useMutation({
    mutationFn: async ({ values, customerId }: { values: IntakeValues; customerId?: string }) => {
      if (demo) {
        const order = await createDemo.mutateAsync(toDemoOrderDraft(values))
        return { id: order.id, code: order.id }
      }
      const order = await orderApi.create(toLiveOrderInput(values, customerId))
      void invalidateLiveData(queryClient)
      return { id: String(order.id), code: order.orderCode }
    },
  })
}
