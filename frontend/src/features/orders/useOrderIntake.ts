import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Customer } from '@/features/customers/types'
import { useStockItems } from '@/features/inventory/useInventory'
import { catalogApi } from '@/features/live/catalogApi'
import { customerApi } from '@/features/live/customerApi'
import { invalidateLiveData } from '@/features/live/invalidateLiveData'
import { orderApi } from '@/features/live/orderApi'
import { toLiveOrderInput, type IntakeValues } from './orderIntake'

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
  const catalog = useQuery({ queryKey: ['live', 'catalog'], queryFn: catalogApi.products })
  const stock = useStockItems()
  const products: IntakeProduct[] = (catalog.data ?? []).map((product) => {
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
  return { products, isPending: catalog.isPending, error: catalog.error, refetch: catalog.refetch }
}

/** Địa chỉ đã lưu của khách; `undefined` là đang tải hoặc không tải được. */
export function useIntakeAddresses(customer: Customer | undefined) {
  const customerId = customer ? Number(customer.id) : undefined
  const query = useQuery({
    queryKey: ['live', 'customer-addresses', customerId],
    queryFn: () => customerApi.addresses(customerId!),
    enabled: customerId !== undefined,
  })
  const addresses: IntakeAddress[] | undefined = query.data?.map((address) => ({
    line: address.addressLine,
    area: address.area ?? undefined,
    recipientName: address.recipientName,
    recipientPhone: address.recipientPhone,
    isDefault: address.isDefault,
  }))
  return { addresses, isError: query.isError, refetch: query.refetch }
}

/** Tạo đơn chờ xác nhận; trả về mã để mở chi tiết và mã hiển thị. */
export function useSubmitIntake() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ values, customerId }: { values: IntakeValues; customerId?: string }) => {
      const order = await orderApi.create(toLiveOrderInput(values, customerId))
      void invalidateLiveData(queryClient)
      return { id: String(order.id), code: order.orderCode }
    },
  })
}
