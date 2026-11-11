import { api } from '@/shared/api/client'
import type { WaterTypeCode } from '@/features/inventory/catalogGroups'

/** DTO theo ProductController/SupplierController hiện có, không suy ra tồn từ danh mục. */
export type CatalogProduct = {
  id: number
  sku: string
  name: string
  brand: string | null
  unit: string
  unitsPerCase: number | null
  bottleTypeId: number | null
  bottleTypeName: string | null
  salePrice: number
  active: boolean
  createdAt: string
  image: string | null
  lowStockThreshold?: number
  /** Mã loại nước (xem `waterTypeLabels`); null là chưa phân loại. */
  waterType?: WaterTypeCode | null
  volumeMl?: number | null
}
export type CatalogSupplier = { id: number; name: string; phone: string | null; address: string | null; active: boolean }

export const catalogApi = {
  products: () => api.get<CatalogProduct[]>('/products?active=true'),
  product: (id: string) => api.get<CatalogProduct>(`/products/${encodeURIComponent(id)}`),
  suppliers: () => api.get<CatalogSupplier[]>('/suppliers?active=true'),
}
