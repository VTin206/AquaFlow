import { type ReactNode, useEffect } from 'react'

type PageProps = { title: string; description?: string; actions?: ReactNode; children: ReactNode }

/** Khung chung của mỗi trang: tiêu đề + nút hành động chính, phần nội dung bên dưới. */
export function Page({ title, description, actions, children }: PageProps) {
  useEffect(() => {
    document.title = `${title} | AquaFlow`
  }, [title])

  return (
    <>
      <header className="af-page-header">
        <div>
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
        {actions && <div className="af-page-actions">{actions}</div>}
      </header>
      <div className="af-page-body">{children}</div>
    </>
  )
}
