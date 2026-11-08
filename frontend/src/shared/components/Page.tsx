import { type ReactNode, useEffect } from 'react'
import { Breadcrumb } from 'antd'
import { Link, useLocation } from 'react-router'

type PageProps = { title: string; description?: string; actions?: ReactNode; children: ReactNode }

/** Khung chung của mỗi trang: tiêu đề + nút hành động chính, phần nội dung bên dưới. */
export function Page({ title, description, actions, children }: PageProps) {
  const { pathname } = useLocation()
  useEffect(() => {
    document.title = `${title} | AquaFlow`
  }, [title])

  return (
    <div className="af-page">
      <header className="af-page-header">
        {pathname !== '/' && (
          <Breadcrumb
            className="af-breadcrumb"
            aria-label="Đường dẫn trang"
            items={[{ title: <Link to="/">Trang chủ</Link> }, { title: <span aria-current="page">{title}</span> }]}
          />
        )}
        <div>
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
        {actions && <div className="af-page-actions">{actions}</div>}
      </header>
      <div className="af-page-body">{children}</div>
    </div>
  )
}
