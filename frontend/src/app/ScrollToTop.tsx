import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router'

/** Sang trang mới thì về đầu trang; bấm Quay lại / Tiến (POP) thì để trình duyệt giữ vị trí cũ. */
export function ScrollToTop() {
  const { pathname } = useLocation()
  const type = useNavigationType()
  useEffect(() => {
    if (type !== 'POP') window.scrollTo(0, 0)
  }, [pathname, type])
  return null
}
