import { Avatar, Badge, Layout, Menu, type MenuProps } from 'antd'
import { Settings2, Waves } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import { navGroups, sectionPaths } from '../../config/navigation'

type SidebarProps = {
  pendingCount: number
  apiOnline: boolean | null
  onNotice: (message: string) => void
}

export function Sidebar({ pendingCount, apiOnline, onNotice }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()

  const items: MenuProps['items'] = navGroups.map((group) => ({
    type: 'group',
    key: group.label,
    label: group.label,
    children: group.items.map(({ id, label, icon: Icon }) => ({
      key: sectionPaths[id],
      icon: <Icon size={18} strokeWidth={1.8} />,
      label: (
        <span className="af-menu-label">
          {label}
          {id === 'orders' && pendingCount > 0 && <Badge count={pendingCount} size="small" color="#d9480f" />}
        </span>
      ),
    })),
  }))

  return (
    <Layout.Sider width={240} breakpoint="lg" collapsedWidth={0} className="af-sider">
      <div className="af-brand">
        <span className="af-brand-mark">
          <Waves size={18} strokeWidth={2.2} />
        </span>
        <div>
          <strong>AquaFlow</strong>
          <small>Chi nhánh chính</small>
        </div>
      </div>
      <Menu mode="inline" items={items} selectedKeys={[location.pathname]} onClick={({ key }) => navigate(key)} className="af-menu" />
      <div className="af-sider-footer">
        <div className={`af-api-status ${apiOnline ? 'online' : 'offline'}`}>
          <i />
          {apiOnline === null ? 'Đang kiểm tra kết nối' : apiOnline ? 'Đã kết nối máy chủ' : 'Đang dùng dữ liệu mẫu'}
        </div>
        <button className="af-sider-link" onClick={() => onNotice('Cài đặt cửa hàng sẽ được bổ sung trong giai đoạn tiếp theo.')}>
          <Settings2 size={18} strokeWidth={1.8} /> Cài đặt
        </button>
        <div className="af-user">
          <Avatar style={{ background: '#e7f3f4', color: '#0b7a83', fontWeight: 600 }}>NA</Avatar>
          <div>
            <strong>Nguyễn An</strong>
            <small>Quản trị viên</small>
          </div>
        </div>
      </div>
    </Layout.Sider>
  )
}
