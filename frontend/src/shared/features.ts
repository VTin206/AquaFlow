import { useAuth } from '../features/auth/useAuth'

/**
 * Phần giao diện đã có API BE hỗ trợ. Bản dùng thử bật hết để giới thiệu đủ thiết kế;
 * tài khoản thật vẫn giữ bố cục nhưng phần cờ tắt bị khóa và ghi "Chưa hỗ trợ" (`Unsupported`),
 * không hiện dữ liệu giả. BE bổ sung field/API nào thì bật cờ đó.
 */
export const backendFeatures = {
  /** Người liên hệ của nhà cung cấp (SupplierResponse chưa có). */
  supplierContactName: false,
  /** Email nhà cung cấp (SupplierResponse chưa có). */
  supplierEmail: false,
  /** Loại khách cá nhân/doanh nghiệp (CustomerResponse chưa có). */
  customerType: false,
  /** Khu vực và ghi chú trên hồ sơ khách (BE chỉ có khu vực theo từng địa chỉ giao). */
  customerProfileExtras: false,
  /** Công nợ của khách (chưa có luồng thanh toán). */
  customerDebt: false,
  /** Sổ vỏ bình và tiền cọc (chưa có API). */
  bottleLedger: false,
  /** Ảnh sản phẩm (ProductResponse chưa có). */
  productImage: false,
  /** Loại nước, dung tích để lọc danh mục (ProductResponse chưa có). */
  productCatalogDetails: false,
  /** Tồn kho tối thiểu để cảnh báo sắp hết (BE chưa có). */
  lowStockThreshold: false,
  /** Phiếu thu, số còn phải thu của đơn (BE chỉ có trạng thái thanh toán, chưa có luồng thu tiền). */
  orderPayments: false,
  /** Thông báo trên thanh trên cùng (chưa có API). */
  notifications: false,
} satisfies Record<string, boolean>

export type BackendFeature = keyof typeof backendFeatures

export const useIsDemo = () => useAuth().user?.isDemo ?? false

/** Trang chưa có API BE: tài khoản thật vẫn thấy trên menu, mở ra là trang "Chưa hỗ trợ". */
const unsupportedPages = new Set(['/', '/delivery', '/driver', '/reports', '/activity', '/settings'])

export function usePageSupported() {
  const demo = useIsDemo()
  return (path: string) => demo || !unsupportedPages.has(path)
}

export function useFeature(feature: BackendFeature) {
  return useIsDemo() || backendFeatures[feature]
}
