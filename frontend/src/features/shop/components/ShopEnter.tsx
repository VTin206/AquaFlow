import { useLayoutEffect, useRef, type ReactNode } from 'react'

/** Các "thẻ" hiện lần lượt khi vào trang mua hàng. */
const CARD_SELECTOR = [
  '.ant-card',
  '.af-shop-banner-slider',
  '.af-shop-news',
  '.af-shop-promo',
  '.af-shop-why-grid > div',
  '.af-shop-steps li',
  '.af-shop-account-card',
  '.af-shop-account-side',
].join(', ')

const STEP = 0.15
const MAX_STEPS = 6

/**
 * Bọc nội dung trang, cho từng thẻ hiện fade-in-up nối tiếp nhau.
 * Thẻ nạp sau (khi dữ liệu về, đổi bộ lọc, sang trang sản phẩm khác) cũng hiện lần lượt như vậy.
 */
export function ShopEnter({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    const reveal = () => {
      let index = 0
      root.querySelectorAll<HTMLElement>(CARD_SELECTOR).forEach((el) => {
        if (el.dataset.afEnter !== undefined) return
        el.dataset.afEnter = ''
        // Thẻ lồng trong thẻ khác đã chạy hiệu ứng cùng thẻ cha.
        if (el.parentElement?.closest('[data-af-enter]')) return
        el.style.setProperty('--af-enter-delay', `${Math.min(index++, MAX_STEPS) * STEP}s`)
        el.classList.add('af-enter-card')
      })
    }
    reveal()
    // Callback chạy trước khi vẽ nên thẻ mới không bị chớp hiện trước khi ẩn.
    const observer = new MutationObserver(reveal)
    observer.observe(root, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className="af-shop-enter">
      {children}
    </div>
  )
}
