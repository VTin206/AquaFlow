/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Địa chỉ gốc của API, mặc định `/api/v1` (đi qua proxy của Vite/nginx). */
  readonly VITE_API_BASE_URL?: string
  /** Chỉ dùng khi dev: tài khoản đăng nhập nhanh, xem `devAccounts.ts`. */
  readonly VITE_DEV_ACCOUNTS?: string
  /** Hotline và giờ mở cửa trên thanh trên cùng trang khách (bản thật), dùng tạm tới khi BE có API cài đặt công khai. */
  readonly VITE_SHOP_HOTLINE?: string
  readonly VITE_SHOP_HOURS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
