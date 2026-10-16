import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * In một chứng từ bằng hộp thoại in của trình duyệt (in ra giấy hoặc lưu PDF).
 * Chứng từ được gắn tạm vào <body>; CSS @media print ẩn toàn bộ giao diện còn lại.
 */
export function usePrinter() {
  const [content, setContent] = useState<ReactNode>(null)

  useEffect(() => {
    if (!content) return
    const done = () => setContent(null)
    window.addEventListener('afterprint', done, { once: true })
    // Đợi một khung hình để chứng từ được vẽ xong trước khi mở hộp thoại in.
    const frame = window.requestAnimationFrame(() => window.print())
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('afterprint', done)
    }
  }, [content])

  return {
    print: (document: ReactNode) => setContent(document),
    portal: content ? createPortal(<div className="af-print-root">{content}</div>, document.body) : null,
  }
}
