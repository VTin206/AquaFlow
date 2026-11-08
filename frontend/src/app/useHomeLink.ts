import type { MouseEvent } from 'react'
import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router'

/** Dấu trong `location.state` để trang chủ dựng lại từ đầu (bỏ bộ lọc, về trang 1). */
export type FreshState = { fresh?: number }

/**
 * Bấm logo: về trang chủ ở đầu trang với dữ liệu mới, như tải lại nhưng không tải lại cả app
 * (giỏ hàng và đăng nhập vẫn giữ, không nháy trắng). Giữ Ctrl/Cmd hoặc chuột giữa thì vẫn mở tab mới như liên kết thường.
 */
export function useHomeLink(home: string, refresh?: QueryKey) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const queryClient = useQueryClient()
  return (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    void (refresh ? queryClient.invalidateQueries({ queryKey: refresh }) : queryClient.invalidateQueries())
    navigate(home, { state: { fresh: Date.now() } satisfies FreshState })
    // Đang ở trang chủ thì đường dẫn không đổi nên ScrollToTop không chạy: tự cuộn lên.
    if (pathname === home) window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}
