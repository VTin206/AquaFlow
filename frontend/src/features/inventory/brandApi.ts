import { useQuery } from '@tanstack/react-query'
import { api } from '@/shared/api/client'
import { useStaff } from '@/features/auth/useStaff'
import { brandGroups } from './catalogGroups'

/** Thương hiệu lưu ở backend; {@code productCount} đếm sản phẩm đã nối (khớp tên hoặc tên gọi khác). */
export type Brand = { id: number; name: string; aliases: string[]; logo: string | null; productCount: number }
export type BrandInput = { name: string; aliases: string[]; logo?: string | null }
export type BrandGroup = { name: string; aliases: string[]; logo?: string }

export const brandApi = {
  list: () => api.get<Brand[]>('/brands'),
  create: (input: BrandInput) => api.post<Brand>('/brands', input),
  update: (id: number, input: BrandInput) => api.put<Brand>(`/brands/${id}`, input),
  remove: (id: number) => api.delete<void>(`/brands/${id}`),
}
export const brandsKey = ['live', 'brands'] as const

/** Danh sách thương hiệu cho nhân viên cửa hàng. */
export function useBrands() {
  const role = useStaff()?.role
  return useQuery({ queryKey: brandsKey, queryFn: brandApi.list, enabled: role === 'ADMIN' || role === 'SALES_STAFF', staleTime: 60_000 })
}

/** Chỉ chủ cửa hàng thêm/sửa/xóa thương hiệu. */
export function useCanManageBrands() {
  return useStaff()?.role === 'ADMIN'
}

/** Thương hiệu để gom và lọc sản phẩm: lấy từ backend, chưa tải được thì dùng danh sách chuẩn có sẵn. */
export function useBrandGroups(): BrandGroup[] {
  const { data } = useBrands()
  if (!data) return brandGroups
  return data.map((brand) => ({
    name: brand.name,
    aliases: [...new Set([brand.name.toLowerCase(), ...brand.aliases])],
    logo: brand.logo ?? undefined,
  }))
}

export const brandGroupOf = (groups: BrandGroup[], brand: string) => {
  const key = brand.trim().toLowerCase()
  return groups.find((group) => group.name.toLowerCase() === key || group.aliases.includes(key))
}
