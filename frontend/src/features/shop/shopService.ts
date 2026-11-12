import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/useAuth'
import { isCustomer } from '@/features/auth/accountAccess'
import { customerOrderApi } from './customerOrderApi'
import { catalogApi, type CatalogProduct } from '@/features/live/catalogApi'
import { guestOrderApi, type GuestOrderInput } from '@/features/live/guestOrderApi'
import { orderTrackingApi } from '@/features/live/orderTrackingApi'
import { catalogFromApi } from '@/features/inventory/catalogGroups'
import type { Product } from '@/features/inventory/types'
import { resolveProductImage } from '@/features/inventory/productImages'
import type { PublicOrder } from '@/features/orders/types'
import { settingsApi } from '@/features/settings/settingsApi'
import type { StoreSettings } from '@/features/settings/types'

// Kênh công khai cho khách; live checkout gửi đơn qua guest order API.

/** Thông tin sản phẩm khách được xem: không lộ số tồn hay giá vốn. */
export type ShopProduct = Pick<Product, 'id' | 'name' | 'brand' | 'unit' | 'price' | 'image' | 'catalog'> & {
  sku: string
  available: boolean | null
  unitsPerCase?: number | null
  bottleTypeName?: string | null
  bottleTypeId?: number | null
}

export type ShopContact = Partial<Pick<StoreSettings, 'storeName' | 'phone' | 'address' | 'email' | 'openingHours'>>

/** Thông tin liên hệ cửa hàng hiện trên trang khách. */
export const useShopContact = (): ShopContact | undefined =>
  useQuery({ queryKey: ['live', 'store-profile'], queryFn: settingsApi.profile, staleTime: 60_000 }).data

export const toShopProduct = (product: CatalogProduct): ShopProduct => ({
  id: String(product.id),
  sku: product.sku,
  name: product.name,
  brand: product.brand ?? '',
  unit: product.unit,
  price: product.salePrice,
  available: product.active ? null : false,
  unitsPerCase: product.unitsPerCase,
  bottleTypeName: product.bottleTypeName,
  bottleTypeId: product.bottleTypeId,
  image: resolveProductImage(product),
  catalog: catalogFromApi(product),
})

export const shopKeys = { products: ['shop', 'products'] as const, track: (token: string) => ['shop', 'track', token] as const }

export const useShopProducts = () =>
  useQuery<ShopProduct[]>({
    queryKey: [...shopKeys.products, 'live'],
    queryFn: () => catalogApi.products().then((products) => products.map(toShopProduct)),
  })

export type WebOrderDraft = {
  customer: string
  phone: string
  address: string
  area: string
  floor?: number
  expectedTotal?: number
  appointment?: string
  note?: string
  lines: { productId: string; quantity: number }[]
}

export const toGuestOrderInput = (draft: WebOrderDraft): GuestOrderInput => ({
  recipientName: draft.customer,
  recipientPhone: draft.phone,
  deliveryAddress: draft.address,
  deliveryArea: draft.area,
  ...(draft.floor !== undefined ? { stairFloor: draft.floor } : {}),
  ...(draft.expectedTotal !== undefined ? { expectedTotal: draft.expectedTotal } : {}),
  items: draft.lines.map((line) => ({ productId: Number(line.productId), quantity: line.quantity })),
  ...(draft.appointment ? { requestedDeliveryAt: draft.appointment } : {}),
  ...(draft.note ? { note: draft.note } : {}),
})

export function useShopProduct(id: string) {
  return useQuery<ShopProduct>({
    queryKey: ['shop', 'product', 'live', id],
    queryFn: async () => toShopProduct(await catalogApi.product(id)),
    retry: false,
  })
}

export function usePlaceWebOrder() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation<Awaited<ReturnType<typeof guestOrderApi.create>>, Error, WebOrderDraft>({
    mutationFn: (draft) => {
      if (isCustomer(user)) return customerOrderApi.create(toGuestOrderInput(draft))
      return guestOrderApi.create(toGuestOrderInput(draft))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live', 'orders-view'] })
      queryClient.invalidateQueries({ queryKey: ['live', 'customer-orders'] })
    },
  })
}

/** Theo dõi đơn qua liên kết riêng; tự cập nhật mỗi 20 giây. */
export function useTrackedOrder(token: string) {
  return useQuery<PublicOrder>({
    queryKey: [...shopKeys.track(token), 'live'],
    queryFn: () => orderTrackingApi.byToken(token),
    retry: false,
    refetchInterval: 20_000,
  })
}

/** Tra cứu bằng mã đơn + số điện thoại đặt hàng. */
export function useLookupOrder() {
  return (id: string, phone: string): Promise<PublicOrder> => orderTrackingApi.lookup(id, phone)
}
