import { useAuth } from '../features/auth/useAuth'

/**
 * Phần giao diện đã có API BE hỗ trợ. Bản dùng thử bật hết để giới thiệu đủ thiết kế;
 * tài khoản thật chỉ hiện phần BE trả dữ liệu thật. BE bổ sung field/API nào thì bật cờ đó.
 */
export const backendFeatures = {
  /** Người liên hệ của nhà cung cấp (SupplierResponse chưa có). */
  supplierContactName: false,
  /** Email nhà cung cấp (SupplierResponse chưa có). */
  supplierEmail: false,
} satisfies Record<string, boolean>

export type BackendFeature = keyof typeof backendFeatures

export function useFeature(feature: BackendFeature) {
  const demo = useAuth().user?.isDemo ?? false
  return demo || backendFeatures[feature]
}
