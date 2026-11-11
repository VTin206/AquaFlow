import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { db } from '@/mocks/db'
import { mockError, mockRequest } from '@/mocks/mockRequest'
import { useAuth } from '@/features/auth/useAuth'
import { isCustomer } from '@/features/auth/accountAccess'
import { rememberDemoOrder } from './demoCustomerData'
import { customerOrderApi } from './customerOrderApi'
import { catalogApi, type CatalogProduct } from '@/features/live/catalogApi'
import { guestOrderApi, type GuestOrderInput } from '@/features/live/guestOrderApi'
import { orderTrackingApi } from '@/features/live/orderTrackingApi'
import { daysUntilExpiry } from '@/features/inventory/expiry'
import { catalogFromApi } from '@/features/inventory/catalogGroups'
import type { Product } from '@/features/inventory/types'
import { resolveProductImage } from '@/features/inventory/productImages'
import { orderService } from '@/features/orders/orderService'
import type { PublicOrder } from '@/features/orders/types'
import { useSettings } from '@/features/settings/settingsService'
import { settingsApi } from '@/features/settings/settingsApi'
import type { StoreSettings } from '@/features/settings/types'
import { backendFeatures, type BackendFeature } from '@/shared/features'

// Kênh công khai cho khách; live checkout gửi đơn qua guest order API.

/** Thông tin sản phẩm khách được xem: không lộ số tồn hay giá vốn. */
export type ShopProduct = Pick<Product, 'id' | 'name' | 'brand' | 'unit' | 'price' | 'image' | 'catalog'> & {
  sku: string
  available: boolean | null
  unitsPerCase?: number | null
  bottleTypeName?: string | null
  bottleTypeId?: number | null
}

/** Dữ liệu mẫu khi đăng nhập bản dùng thử, hoặc khi dev chọn "xem như khách". */
export const useShopDemo = () => {
  const { user, demoGuest } = useAuth()
  return Boolean(user?.isDemo || demoGuest)
}

/** Như `useFeature` nhưng cho trang khách, gồm cả chế độ dev "xem như khách". */
export const useShopFeature = (feature: BackendFeature) => {
  const demo = useShopDemo()
  return demo || backendFeatures[feature]
}

export type ShopContact = Partial<Pick<StoreSettings, 'storeName' | 'phone' | 'address' | 'email' | 'openingHours'>>

/** Thông tin liên hệ cửa hàng hiện trên trang khách. */
export const useShopContact = (): ShopContact | undefined => {
  const demo = useShopDemo()
  const settings = useSettings(demo)
  const profile = useQuery({ queryKey: ['live', 'store-profile'], queryFn: settingsApi.profile, enabled: !demo, staleTime: 60_000 })
  return demo ? settings.data : profile.data
}

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

export const shopService = {
  products: () =>
    mockRequest(() =>
      db.products
        .filter((product) => product.sku !== 'VO-20L' && product.price > 0)
        .map(({ id, sku, name, brand, unit, price, image, catalog, stock, expiry }) => ({
          id,
          sku,
          name,
          brand,
          unit,
          price,
          image,
          catalog,
          available: stock > 0 && (daysUntilExpiry(expiry) ?? 0) >= 0,
        })),
    ),
}

export const shopKeys = { products: ['shop', 'products'] as const, track: (token: string) => ['shop', 'track', token] as const }

export const useShopProducts = () => {
  const demo = useShopDemo()
  return useQuery<ShopProduct[]>({
    queryKey: [...shopKeys.products, demo ? 'demo' : 'live'],
    queryFn: () => (demo ? shopService.products() : catalogApi.products().then((products) => products.map(toShopProduct))),
  })
}

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
  const demo = useShopDemo()
  return useQuery<ShopProduct>({
    queryKey: ['shop', 'product', demo ? 'demo' : 'live', id],
    queryFn: async () => {
      if (!demo) return toShopProduct(await catalogApi.product(id))
      const product = (await shopService.products()).find((item) => item.id === id)
      if (!product) throw mockError(404, 'Không tìm thấy sản phẩm.')
      return product
    },
    retry: false,
  })
}

export function usePlaceWebOrder() {
  const { user } = useAuth()
  const demo = useShopDemo()
  const queryClient = useQueryClient()
  return useMutation<PublicOrder | Awaited<ReturnType<typeof guestOrderApi.create>>, Error, WebOrderDraft>({
    mutationFn: (draft) => {
      if (demo) return orderService.placeWebOrder(draft)
      if (isCustomer(user)) return customerOrderApi.create(toGuestOrderInput(draft))
      return guestOrderApi.create(toGuestOrderInput(draft))
    },
    onSuccess: (order) => {
      if (demo) {
        if (user?.isDemo) rememberDemoOrder(String(order.id))
        // Làm mới các màn quản lý dùng chung dữ liệu mẫu.
        for (const key of [['orders'], ['customers'], ['products'], ['activity'], shopKeys.products])
          queryClient.invalidateQueries({ queryKey: key })
      } else {
        queryClient.invalidateQueries({ queryKey: ['live', 'orders-view'] })
        queryClient.invalidateQueries({ queryKey: ['live', 'customer-orders'] })
      }
    },
  })
}

/** Theo dõi đơn qua liên kết riêng; tự cập nhật mỗi 20 giây. */
export function useTrackedOrder(token: string) {
  const demo = useShopDemo()
  return useQuery<PublicOrder>({
    queryKey: [...shopKeys.track(token), demo ? 'demo' : 'live'],
    queryFn: () => (demo ? orderService.track({ token }) : orderTrackingApi.byToken(token)),
    retry: false,
    refetchInterval: 20_000,
  })
}

/** Tra cứu bằng mã đơn + số điện thoại đặt hàng. */
export function useLookupOrder() {
  const demo = useShopDemo()
  return (id: string, phone: string): Promise<PublicOrder> =>
    demo ? orderService.track({ id, phone }) : orderTrackingApi.lookup(id, phone)
}
