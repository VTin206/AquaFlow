import type { ReactNode } from 'react'
import { Bell, CalendarDays, ChevronDown, ChevronRight, Menu } from 'lucide-react'
import { sectionCopy } from '../../config/navigation'
import type { Section } from '../../types'

type TopbarProps = { section: Section; action: ReactNode; onOpenMenu: () => void; onNotice: (message: string) => void }

export function Topbar({ section, action, onOpenMenu, onNotice }: TopbarProps) {
  const title = sectionCopy[section]
  const today = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())
  const hour = new Date().getHours()
  const greeting = hour < 11 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối'
  const isOverview = section === 'overview'

  return (
    <header className="topbar">
      <div className="heading-area">
        <button className="icon-button mobile-menu" aria-label="Mở menu" onClick={onOpenMenu}>
          <Menu size={19} />
        </button>
        <div className="breadcrumb">
          AquaFlow <ChevronRight size={13} /> <span>{title.title}</span>
        </div>
        <div className="page-heading">
          <h1>
            {isOverview ? `${greeting}, Nguyễn An` : title.title}
            <span className="wave-emoji">{isOverview ? ' 👋' : ''}</span>
          </h1>
          <p>{isOverview ? 'Đây là những gì đang diễn ra tại cửa hàng của bạn hôm nay.' : title.description}</p>
        </div>
      </div>
      <div className="topbar-actions">
        {action}
        <div className="date-chip">
          <CalendarDays size={16} />
          <span>{today}</span>
        </div>
        <button className="icon-button notification-button" aria-label="Thông báo" onClick={() => onNotice('Bạn đã xem hết thông báo mới.')}>
          <Bell size={18} />
          <i />
        </button>
        <div className="topbar-divider" />
        <div className="top-user">
          <div className="user-avatar">NA</div>
          <ChevronDown size={15} />
        </div>
      </div>
    </header>
  )
}
