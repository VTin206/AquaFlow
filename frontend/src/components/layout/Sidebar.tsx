import { ChevronDown, Droplets, Ellipsis, Settings2, Waves, X } from 'lucide-react'
import { navGroups } from '../../config/navigation'
import type { Section } from '../../types'

type SidebarProps = {
  section: Section
  open: boolean
  pendingCount: number
  apiOnline: boolean | null
  onNavigate: (section: Section) => void
  onClose: () => void
  onNotice: (message: string) => void
}

export function Sidebar({ section, open, pendingCount, apiOnline, onNavigate, onClose, onNotice }: SidebarProps) {
  return (
    <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
      <div className="brand">
        <div className="brand-mark">
          <Waves size={21} strokeWidth={2.4} />
        </div>
        <div>
          <strong>AquaFlow</strong>
          <span>QUẢN LÝ ĐẠI LÝ NƯỚC</span>
        </div>
        <button className="icon-button sidebar-close" aria-label="Đóng menu" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      <div className="store-switch">
        <div className="store-avatar">
          <Droplets size={17} />
        </div>
        <div>
          <strong>Đại lý AquaFlow</strong>
          <span>Chi nhánh chính</span>
        </div>
        <ChevronDown size={16} />
      </div>
      <nav className="main-nav" aria-label="Điều hướng chính">
        {navGroups.map((group) => (
          <div className="nav-group" key={group.label}>
            <p className="nav-label">{group.label}</p>
            {group.items.map(({ id, label, icon: Icon }) => (
              <button key={id} className={`nav-item ${section === id ? 'active' : ''}`} onClick={() => onNavigate(id)}>
                <Icon size={18} strokeWidth={1.9} />
                <span>{label}</span>
                {id === 'orders' && <span className="nav-count">{pendingCount.toString().padStart(2, '0')}</span>}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="api-status">
          <i className={`status-dot ${apiOnline === null ? 'checking' : apiOnline ? 'online' : 'offline'}`} />
          <span>{apiOnline === null ? 'Đang kiểm tra kết nối' : apiOnline ? 'Hệ thống đang hoạt động' : 'Đang dùng dữ liệu mẫu'}</span>
        </div>
        <button className="nav-item settings-link" onClick={() => onNotice('Cài đặt cửa hàng sẽ được bổ sung trong giai đoạn tiếp theo.')}>
          <Settings2 size={18} /> Cài đặt
        </button>
        <div className="user-profile">
          <div className="user-avatar">NA</div>
          <div className="user-details">
            <strong>Nguyễn An</strong>
            <span>Quản trị viên</span>
          </div>
          <button className="profile-more" aria-label="Tùy chọn tài khoản" onClick={() => onNotice('Tài khoản Nguyễn An')}>
            <Ellipsis size={19} />
          </button>
        </div>
      </div>
    </aside>
  )
}
