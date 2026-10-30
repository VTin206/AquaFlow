import type { LoginCredentials } from './authService'

export type DevAccount = LoginCredentials & { label: string }

/**
 * Tài khoản đăng nhập nhanh khi chạy dev, đọc từ `VITE_DEV_ACCOUNTS` trong `.env.local` (không commit).
 * Định dạng: `Nhãn|email|mật khẩu`, nhiều tài khoản cách nhau bằng dấu `;`. Bản build production luôn rỗng.
 */
export const devAccounts: DevAccount[] = import.meta.env.DEV
  ? (import.meta.env.VITE_DEV_ACCOUNTS ?? '')
      .split(';')
      .map((entry) => entry.split('|').map((part) => part.trim()))
      .filter((parts) => parts.length === 3 && parts.every(Boolean))
      .map(([label, email, password]) => ({ label, email, password }))
  : []
