import { useAuth } from '@/features/auth/useAuth'

/**
 * Phần giao diện đã có API BE hỗ trợ. Bản dùng thử bật hết để giới thiệu đủ thiết kế;
 * tài khoản thật vẫn giữ bố cục nhưng phần cờ tắt bị khóa và ghi "Chưa hỗ trợ" (`Unsupported`),
 * không hiện dữ liệu giả. BE bổ sung field/API nào thì bật cờ đó.
 */
export const backendFeatures = {
  /** Người liên hệ của nhà cung cấp (SupplierController). */
  supplierContactName: true,
  /** Email nhà cung cấp (SupplierController). */
  supplierEmail: true,
  /** Loại khách cá nhân/doanh nghiệp (CustomerController). */
  customerType: true,
  /** Khu vực và ghi chú trên hồ sơ khách (CustomerController). */
  customerProfileExtras: true,
  /** Công nợ của khách (chưa có luồng thanh toán). */
  customerDebt: false,
  /** Sổ vỏ bình và tiền cọc (chưa có API). */
  bottleLedger: false,
  /** Ảnh sản phẩm được lưu và trả về qua ProductController. */
  productImage: true,
  /** Loại nước, dung tích để lọc danh mục (ProductResponse chưa có). */
  productCatalogDetails: false,
  /** Tồn kho tối thiểu để cảnh báo sắp hết (ProductController, mặc định 10). */
  lowStockThreshold: true,
  /** Phiếu thu, số còn phải thu của đơn (BE chỉ có trạng thái thanh toán, chưa có luồng thu tiền). */
  orderPayments: false,

  /** Kiểm hàng hoàn theo lô sau chuyến giao thất bại (Inventory Return API). */
  deliveryReturns: true,

  /** Bật lại nhà cung cấp, loại vỏ đã ngừng và xem/khôi phục khách đã lưu trữ (BE mới có chiều ngừng). */
  reactivate: false,
  /** Hộp thông báo cá nhân qua NotificationController. */
  notifications: true,
  /** Đăng ký và đăng nhập cho khách (AuthController mới có login, me cho nhân viên). Form đăng ký đang khóa nên ẩn mọi lối vào, kể cả bản dùng thử. */
  customerAccounts: false,
  /** Doanh thu, tiền đã thu trên Tổng quan (chờ API báo cáo). */
  revenueReports: false,
  /** Khách tự tra cứu đơn theo mã + số điện thoại hoặc liên kết riêng (chờ API công khai). */
  orderTracking: false,
  /** In hóa đơn, phiếu giao (cần thông tin cửa hàng trên chứng từ). */
  orderPrinting: false,
  /** Báo trước phí giao cho khách trên trang đặt hàng (BE tính khi xác nhận). */
  deliveryQuote: false,
  /** Thông tin cửa hàng và ngưỡng cảnh báo qua StoreSettingsController. */
  storeSettings: true,
} satisfies Record<string, boolean>

export type BackendFeature = keyof typeof backendFeatures

/**
 * Giao diện dùng chung cho mọi tài khoản: chỗ khác nhau theo API thì dùng `useFeature`, không rẽ nhánh theo bản dùng thử.
 * `useIsDemo` chỉ dành cho lớp dữ liệu và nhãn báo "Dữ liệu mẫu".
 */
export const useIsDemo = () => useAuth().user?.isDemo ?? false

/** Có API thật nhưng dữ liệu mẫu không mô phỏng, nên bản dùng thử không mở được. */
export const useLiveOnly = () => !useIsDemo()

/** Trang chưa có API BE: tài khoản thật vẫn thấy trên menu, mở ra là trang "Chưa hỗ trợ". */
const unsupportedPages = new Set<string>()

export function usePageSupported() {
  const demo = useIsDemo()
  return (path: string) => demo || !unsupportedPages.has(path)
}

export function useFeature(feature: BackendFeature) {
  return useIsDemo() || backendFeatures[feature]
}
