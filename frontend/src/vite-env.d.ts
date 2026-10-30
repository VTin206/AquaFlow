/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Địa chỉ gốc của API, mặc định `/api/v1` (đi qua proxy của Vite/nginx). */
  readonly VITE_API_BASE_URL?: string
  /** Chỉ dùng khi dev: tài khoản đăng nhập nhanh, xem `devAccounts.ts`. */
  readonly VITE_DEV_ACCOUNTS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
