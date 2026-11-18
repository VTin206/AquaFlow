import { api } from '@/shared/api/client'

/** Theo ProductCategoryController. `productCount` gồm cả sản phẩm đã ngừng bán; còn sản phẩm thì không xóa được. */
export type ProductCategory = { id: number; name: string; active: boolean; productCount: number }

export const productCategoryApi = {
  list: () => api.get<ProductCategory[]>('/product-categories'),
  create: (name: string) => api.post<ProductCategory>('/product-categories', { name: name.trim() }),
  /** `active`: false ngừng dùng, true dùng lại; bỏ trống giữ nguyên. */
  update: (id: number, input: { name: string; active?: boolean }) =>
    api.put<ProductCategory>(`/product-categories/${id}`, { ...input, name: input.name.trim() }),
  remove: (id: number) => api.delete<void>(`/product-categories/${id}`),
}
