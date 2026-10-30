import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../shared/api/client'
import { useIsDemo } from '../../shared/features'
import { useStaff } from '../auth/useStaff'
import { inventoryApi } from '../live/inventoryApi'
import { invalidateLiveData } from '../live/invalidateLiveData'
import { productService } from './productService'
import { resolveProductImage } from './productImages'
import { isLowStock, type Product } from './types'
import { productKeys } from './useProducts'

/**
 * Danh mục cho trang Sản phẩm: bản dùng thử đọc mock, tài khoản thật gọi ProductController (BE2)
 * và lấy số khả dụng từ tồn kho. Field BE chưa có (loại nước, dung tích) ẩn qua `useFeature`.
 */
export type CatalogItem = Pick<Product, 'id' | 'sku' | 'name' | 'brand' | 'unit' | 'price' | 'image' | 'catalog'> & {
  active: boolean
  /** Số bán được; undefined khi chưa tải được tồn kho. */
  stock?: number
  lowStock: boolean
  /** Khả dụng từ mức này trở xuống là sắp hết. */
  threshold?: number
  unitsPerCase?: number
  bottleTypeId?: number
  bottleTypeName?: string
}
export type ProductStatus = 'active' | 'inactive' | 'all'
export type ProductForm = { sku: string; name: string; brand?: string; unit: string; price: number; stock?: number; image?: string; unitsPerCase?: number; bottleTypeId?: number; threshold?: number }

type ProductResponse = {
  id: number; sku: string; name: string; brand: string | null; unit: string; image: string | null
  unitsPerCase: number | null; bottleTypeId: number | null; bottleTypeName: string | null; salePrice: number; active: boolean
  lowStockThreshold?: number
}

const fromDemo = (product: Product): CatalogItem => ({
  id: product.id, sku: product.sku, name: product.name, brand: product.brand, unit: product.unit, price: product.price, image: product.image, catalog: product.catalog,
  active: product.active !== false, stock: product.stock, lowStock: isLowStock(product),
})

const fromResponse = (product: ProductResponse, available?: number): CatalogItem => ({
  id: String(product.id), sku: product.sku, name: product.name, brand: product.brand ?? 'Chưa có thương hiệu', unit: product.unit, price: Number(product.salePrice),
  active: product.active, stock: available, image: resolveProductImage(product), threshold: product.lowStockThreshold,
  lowStock: available !== undefined && (product.lowStockThreshold === undefined ? available === 0 : available <= product.lowStockThreshold),
  unitsPerCase: product.unitsPerCase ?? undefined, bottleTypeId: product.bottleTypeId ?? undefined, bottleTypeName: product.bottleTypeName ?? undefined,
})

const toRequest = (form: ProductForm) => ({
  name: form.name.trim(), brand: form.brand?.trim() || null, unit: form.unit, salePrice: form.price,
  unitsPerCase: form.unitsPerCase ?? null, bottleTypeId: form.bottleTypeId ?? null, image: form.image ?? null,
  lowStockThreshold: form.threshold ?? null,
})

/** Nhân viên chưa xem được tồn kho thì danh mục vẫn hiện, chỉ thiếu số tồn. */
async function liveCatalog(status: ProductStatus) {
  const [products, stock] = await Promise.all([
    api.get<ProductResponse[]>(`/products${status === 'all' ? '' : `?active=${status === 'active'}`}`),
    inventoryApi.stock().catch(() => undefined),
  ])
  const available = new Map(stock?.map((item) => [item.productId, item.available]))
  return products.map((product) => fromResponse(product, stock ? available.get(product.id) ?? 0 : undefined))
}

/** Bản dùng thử: quản lý và bán hàng được sửa; tài khoản thật: theo BE, chỉ ADMIN. */
export function useCanManageProducts() {
  const demo = useIsDemo()
  const role = useStaff()?.role
  return demo ? role === 'ADMIN' || role === 'SALES_STAFF' : role === 'ADMIN'
}

export function useCatalog(status: ProductStatus) {
  const demo = useIsDemo()
  const staff = useStaff()
  return useQuery({
    queryKey: demo ? [...productKeys.all, 'catalog', status] : ['live', 'products', staff?.name, staff?.role, status],
    queryFn: async () => demo
      ? (await productService.listAll()).map(fromDemo).filter((item) => status === 'all' || item.active === (status === 'active'))
      : liveCatalog(status),
  })
}

const useInvalidateProducts = () => {
  const queryClient = useQueryClient()
  return () => Promise.all([invalidateLiveData(queryClient), queryClient.invalidateQueries({ queryKey: productKeys.all })])
}

/** Thêm mới khi không có `id`; khi sửa, mã sản phẩm và tồn kho không đổi (tồn chỉ tăng qua phiếu nhập). */
export function useSaveProduct() {
  const demo = useIsDemo()
  const invalidate = useInvalidateProducts()
  return useMutation({
    mutationFn: async ({ id, form }: { id?: string; form: ProductForm }): Promise<{ name: string }> => {
      if (demo) {
        const draft = { name: form.name, brand: form.brand, unit: form.unit, price: form.price, image: form.image }
        return id ? productService.update(id, draft) : productService.create({ ...draft, sku: form.sku, stock: form.stock ?? 0 })
      }
      return id ? api.put<ProductResponse>(`/products/${id}`, toRequest(form)) : api.post<ProductResponse>('/products', { sku: form.sku.trim(), ...toRequest(form) })
    },
    onSuccess: () => void invalidate(),
  })
}

/** BE chưa có API bán lại nên chỉ bản dùng thử (cờ `reactivate`). */
export function useActivateProduct() {
  const invalidate = useInvalidateProducts()
  return useMutation({ mutationFn: productService.activate, onSuccess: () => void invalidate() })
}

export function useDeactivateProduct() {
  const demo = useIsDemo()
  const invalidate = useInvalidateProducts()
  return useMutation({
    mutationFn: (id: string) => (demo ? productService.deactivate(id) : api.delete<void>(`/products/${id}`)),
    onSuccess: () => void invalidate(),
  })
}
