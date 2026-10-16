import type { ReactNode } from 'react'
import { Badge, Button, Layout, Tooltip } from 'antd'
import { Bell } from 'lucide-react'
import { sectionCopy } from '../../config/navigation'
import type { Section } from '../../types'

type TopbarProps = { section: Section; action: ReactNode; onNotice: (message: string) => void }

export function Topbar({ section, action, onNotice }: TopbarProps) {
  const title = sectionCopy[section]
  const today = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' }).format(new Date())

  return (
    <Layout.Header className="af-header">
      <div className="af-header-title">
        <h1>{title.title}</h1>
        <p>
          {title.description} <span className="af-header-date">· {today}</span>
        </p>
      </div>
      <div className="af-header-actions">
        {action}
        <Tooltip title="Thông báo">
          <Badge dot offset={[-6, 6]}>
            <Button type="text" shape="circle" aria-label="Thông báo" icon={<Bell size={18} />} onClick={() => onNotice('Bạn đã xem hết thông báo mới.')} />
          </Badge>
        </Tooltip>
      </div>
    </Layout.Header>
  )
}
