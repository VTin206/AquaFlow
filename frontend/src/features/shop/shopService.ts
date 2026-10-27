import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { db } from '../../mocks/db'
import { mockError, mockRequest } from '../../mocks/mockRequest'
import { useAuth } from '../auth/useAuth'
import { catalogApi, type CatalogProduct } from '../live/catalogApi'
import { daysUntilExpiry } from '../inventory/expiry'
import type { Product } from '../inventory/types'
import { orderService } from '../orders/orderService'

// Kênh công khai cho khách, không cần đăng nhập. Backend thật cần API public riêng, giới hạn tần suất đặt đơn.

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
  return useMutation({
    mutationFn: (draft: Parameters<typeof orderService.placeWebOrder>[0]) => {
      if (!demo) return Promise.reject(new Error('Đặt hàng trực tuyến chưa khả dụng. Đơn chưa được gửi.'))
      return orderService.placeWebOrder(draft)
    },
    onSuccess: () => {
      // Đơn website hiện ngay ở trang quản lý (cùng dữ liệu mẫu trong tab).
      for (const key of [['orders'], ['customers'], ['products'], ['activity'], shopKeys.products]) queryClient.invalidateQueries({ queryKey: key })
    },
  })
}

export const useTrackedOrder = (token: string) =>
  useQuery({ queryKey: shopKeys.track(token), queryFn: () => orderService.track({ token }), retry: false, refetchInterval: 20_000 })

export const lookupOrder = (id: string, phone: string) => orderService.track({ id, phone })
