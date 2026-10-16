import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { db } from '../../mocks/db'
import { mockRequest } from '../../mocks/mockRequest'
import { daysUntilExpiry } from '../inventory/expiry'
import type { Product } from '../inventory/types'
import { orderService } from '../orders/orderService'

// Kênh công khai cho khách, không cần đăng nhập. Backend thật cần API public riêng, giới hạn tần suất đặt đơn.

/** Thông tin sản phẩm khách được xem: không lộ số tồn hay giá vốn. */
export type ShopProduct = Pick<Product, 'id' | 'name' | 'brand' | 'unit' | 'price' | 'image' | 'catalog'> & { available: boolean }

export const shopService = {
  products: () =>
    mockRequest(() =>
      db.products
        .filter((product) => product.sku !== 'VO-20L' && product.price > 0)
        .map(({ id, name, brand, unit, price, image, catalog, stock, expiry }) => ({
          id,
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

export const useShopProducts = () => useQuery({ queryKey: shopKeys.products, queryFn: shopService.products })

export function usePlaceWebOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: orderService.placeWebOrder,
    onSuccess: () => {
      // Đơn website hiện ngay ở trang quản lý (cùng dữ liệu mẫu trong tab).
      for (const key of [['orders'], ['customers'], ['products'], ['activity'], shopKeys.products]) queryClient.invalidateQueries({ queryKey: key })
    },
  })
}

export const useTrackedOrder = (token: string) =>
  useQuery({ queryKey: shopKeys.track(token), queryFn: () => orderService.track({ token }), retry: false, refetchInterval: 20_000 })

export const lookupOrder = (id: string, phone: string) => orderService.track({ id, phone })
