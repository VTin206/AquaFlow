import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/shared/api/client'
import { bottleTypeApi } from '@/features/live/bottleTypeApi'
import { useStaff } from '@/features/auth/useStaff'
import { inventoryApi } from '@/features/live/inventoryApi'
import { invalidateLiveData } from '@/features/live/invalidateLiveData'
import { resolveProductImage } from './productImages'
import type { Product } from './types'
import { catalogFromApi } from './catalogGroups'
import { productCategoryApi } from '@/features/live/productCategoryApi'
import { sortByName } from '@/shared/utils/table'

/**
 * Danh mục cho trang Sản phẩm: gọi ProductController (BE2)
 * và lấy số khả dụng từ tồn kho. Dung tích chưa nhập thì đoán từ tên (`catalogFromApi`).
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
  /** Giá trị đã lưu (không phải phần đoán từ tên); undefined khi chưa nhập. */
  categoryId?: number
  volumeMl?: number
}
export type ProductStatus = 'active' | 'inactive' | 'all'
export type ProductForm = {
  /** Để trống khi thêm mới: BE tự cấp mã SP00001... */
  sku?: string
  name: string
  brand?: string
  unit: string
  price: number
  image?: string
  unitsPerCase?: number
  bottleTypeId?: number
  threshold?: number
  categoryId?: number
  volumeMl?: number
}

type ProductResponse = {
  id: number
  sku: string
  name: string
  brand: string | null
  unit: string
  image: string | null
  unitsPerCase: number | null
  bottleTypeId: number | null
  bottleTypeName: string | null
  salePrice: number
  active: boolean
  lowStockThreshold?: number
  categoryId?: number | null
  categoryName?: string | null
  volumeMl?: number | null
}

const fromResponse = (product: ProductResponse, available?: number): CatalogItem => ({
  id: String(product.id),
  sku: product.sku,
  name: product.name,
  brand: product.brand ?? 'Chưa có thương hiệu',
  unit: product.unit,
  price: Number(product.salePrice),
  active: product.active,
  stock: available,
  image: resolveProductImage(product),
  threshold: product.lowStockThreshold,
  lowStock: available !== undefined && (product.lowStockThreshold === undefined ? available === 0 : available <= product.lowStockThreshold),
  unitsPerCase: product.unitsPerCase ?? undefined,
  bottleTypeId: product.bottleTypeId ?? undefined,
  bottleTypeName: product.bottleTypeName ?? undefined,
  catalog: catalogFromApi(product),
  categoryId: product.categoryId ?? undefined,
  volumeMl: product.volumeMl ?? undefined,
})

const toRequest = (form: ProductForm) => ({
  name: form.name.trim(),
  brand: form.brand?.trim() || null,
  unit: form.unit,
  salePrice: form.price,
  unitsPerCase: form.unitsPerCase ?? null,
  bottleTypeId: form.bottleTypeId ?? null,
  image: form.image ?? null,
  lowStockThreshold: form.threshold ?? null,
  // Bỏ trống thì xóa giá trị đã lưu (BE coi thiếu field là giữ nguyên, 0 là bỏ phân loại).
  categoryId: form.categoryId ?? 0,
  volumeMl: form.volumeMl ?? 0,
})

/** Nhân viên chưa xem được tồn kho thì danh mục vẫn hiện, chỉ thiếu số tồn. */
async function liveCatalog(status: ProductStatus) {
  const [products, stock] = await Promise.all([
    api.get<ProductResponse[]>(`/products${status === 'all' ? '' : `?active=${status === 'active'}`}`),
    inventoryApi.stock().catch(() => undefined),
  ])
  const available = new Map(stock?.map((item) => [item.productId, item.available]))
  return products.map((product) => fromResponse(product, stock ? (available.get(product.id) ?? 0) : undefined))
}

/** Store staff manage the catalog. */
export function useCanManageProducts() {
  const role = useStaff()?.role
  return role === 'ADMIN' || role === 'SALES_STAFF'
}

export function useCatalog(status: ProductStatus) {
  const staff = useStaff()
  return useQuery({
    queryKey: ['live', 'products', staff?.name, staff?.role, status],
    queryFn: () => liveCatalog(status),
    select: sortByName,
  })
}

const useInvalidateProducts = () => {
  const queryClient = useQueryClient()
  return () => invalidateLiveData(queryClient)
}

/** Loại sản phẩm do cửa hàng quản lý (cả loại đã ngừng dùng), cho form sản phẩm và cửa sổ quản lý loại. */
export function useProductCategories(enabled = true) {
  return useQuery({ queryKey: ['live', 'product-categories'], queryFn: productCategoryApi.list, enabled })
}

/** Loại vỏ cho form sản phẩm, cùng nguồn với danh mục loại vỏ. */
export function useBottleTypeOptions(enabled: boolean) {
  const query = useQuery({
    queryKey: ['live', 'bottle-types', 'product-form'],
    queryFn: () => bottleTypeApi.list(),
    enabled,
  })
  return { types: query.data ?? [], isPending: query.isPending }
}

/** Thêm mới khi không có `id`; khi sửa, mã sản phẩm và tồn kho không đổi (tồn chỉ tăng qua phiếu nhập). */
export function useSaveProduct() {
  const invalidate = useInvalidateProducts()
  return useMutation({
    mutationFn: async ({ id, form }: { id?: string; form: ProductForm }): Promise<{ name: string; sku: string }> => {
      return id
        ? api.put<ProductResponse>(`/products/${id}`, toRequest(form))
        : api.post<ProductResponse>('/products', { sku: form.sku?.trim() || null, ...toRequest(form) })
    },
    onSuccess: () => void invalidate(),
  })
}

/** Bán lại sản phẩm đã ngừng. BE từ chối (409) khi loại vỏ đi kèm còn ngừng lưu hành. */
export function useActivateProduct() {
  const invalidate = useInvalidateProducts()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.post<ProductResponse>(`/products/${id}/reactivate`)
    },
    onSuccess: () => void invalidate(),
  })
}

export function useDeactivateProduct() {
  const invalidate = useInvalidateProducts()
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/products/${id}`),
    onSuccess: () => void invalidate(),
  })
}
