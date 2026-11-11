import { useAuth } from '@/features/auth/useAuth'

/**
 * Bản dùng thử và tài khoản thật dùng chung giao diện. `useIsDemo` chỉ dành cho lớp dữ liệu (đọc mock hay gọi API)
 * và nhãn báo "Dữ liệu mẫu"; không dùng để ẩn/hiện chức năng.
 */
export const useIsDemo = () => useAuth().user?.isDemo ?? false

/** Có API thật nhưng dữ liệu mẫu không mô phỏng, nên bản dùng thử không mở được. */
export const useLiveOnly = () => !useIsDemo()
