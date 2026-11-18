import { type ReactNode, useEffect } from 'react'

type PageProps = { title: string; actions?: ReactNode; children: ReactNode }

/**
 * Khung chung của mỗi trang: tiêu đề + nút hành động chính, phần nội dung bên dưới.
 * Không có breadcrumb: menu bên trái đã cho biết đang ở đâu, bỏ đi để nội dung lên cao hơn.
 */
export function Page({ title, actions, children }: PageProps) {
  useEffect(() => {
    document.title = `${title} | AquaFlow`
  }, [title])

  return (
    <div className="af-page">
      <header className="af-page-header">
        <h1>{title}</h1>
        {actions && <div className="af-page-actions">{actions}</div>}
      </header>
      <div className="af-page-body">{children}</div>
    </div>
  )
}
