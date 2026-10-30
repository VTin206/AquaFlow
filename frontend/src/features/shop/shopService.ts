import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { db } from '../../mocks/db'
import { mockError, mockRequest } from '../../mocks/mockRequest'
import { useAuth } from '../auth/useAuth'
import { catalogApi, type CatalogProduct } from '../live/catalogApi'
import { guestOrderApi, type GuestOrderInput } from '../live/guestOrderApi'
import { daysUntilExpiry } from '../inventory/expiry'
import type { Product } from '../inventory/types'
import { orderService } from '../orders/orderService'
import type { PublicOrder } from '../orders/types'

// Kênh công khai cho khách; live checkout gửi đơn qua guest order API.

/** Thông tin sản phẩm khách được xem: không lộ số tồn hay giá vốn. */
export type ShopProduct = Pick<Product, 'id' | 'name' | 'brand' | 'unit' | 'price' | 'image' | 'catalog'> & { sku: string; available: boolean | null; unitsPerCase?: number | null; bottleTypeName?: string | null }

export const useShopDemo = () => Boolean(useAuth().user?.isDemo)

export const toShopProduct = (product: CatalogProduct): ShopProduct => ({
  id: String(product.id), sku: product.sku, name: product.name, brand: product.brand ?? '',
  unit: product.unit, price: product.salePrice, available: product.active ? null : false,
  unitsPerCase: product.unitsPerCase, bottleTypeName: product.bottleTypeName,
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
    queryFn: () => demo ? shopService.products() : catalogApi.products().then((products) => products.map(toShopProduct)),
  })
}

export type WebOrderDraft = {
  customer: string
  phone: string
  address: string
  area: string
  floor?: number
  appointment?: string
  note?: string
  lines: { productId: string; quantity: number }[]
}

export const toGuestOrderInput = (draft: WebOrderDraft): GuestOrderInput => ({
  recipientName: draft.customer,
  recipientPhone: draft.phone,
  deliveryAddress: draft.address,
  deliveryArea: draft.area,
  items: draft.lines.map((line) => ({ productId: Number(line.productId), quantity: line.quantity })),
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
  const demo = useShopDemo()
  const queryClient = useQueryClient()
  return useMutation<PublicOrder | Awaited<ReturnType<typeof guestOrderApi.create>>, Error, WebOrderDraft>({
    mutationFn: (draft) => {
      if (demo) return orderService.placeWebOrder(draft)
      return guestOrderApi.create(toGuestOrderInput(draft))
    },
    onSuccess: () => {
      if (demo) {
        // Làm mới các màn quản lý dùng chung dữ liệu mẫu.
        for (const key of [['orders'], ['customers'], ['products'], ['activity'], shopKeys.products]) queryClient.invalidateQueries({ queryKey: key })
      } else {
        queryClient.invalidateQueries({ queryKey: ['live', 'orders'] })
      }
    },
  })
}

export const useTrackedOrder = (token: string) =>
  useQuery({ queryKey: shopKeys.track(token), queryFn: () => orderService.track({ token }), retry: false, refetchInterval: 20_000 })

export const lookupOrder = (id: string, phone: string) => orderService.track({ id, phone })
