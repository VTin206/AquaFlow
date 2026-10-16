import { type ReactNode, useEffect } from 'react'
import { Badge, Button, Tooltip } from 'antd'
import { Bell } from 'lucide-react'

type PageProps = { title: string; description?: string; actions?: ReactNode; children: ReactNode }

/** Khung chung của mỗi trang: thanh tiêu đề + nút hành động chính, phần nội dung bên dưới. */
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
        <div className="af-page-actions">
          {actions}
          <Tooltip title="Thông báo">
            <Badge dot offset={[-6, 6]}>
              <Button type="text" shape="circle" aria-label="Thông báo" icon={<Bell size={18} />} />
            </Badge>
          </Tooltip>
        </div>
      </header>
      <div className="af-page-body">{children}</div>
    </>
  )
}
