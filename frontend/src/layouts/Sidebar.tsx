import { App, Avatar, Badge, Menu, type MenuProps } from 'antd'
import { Settings2, Waves } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import { navGroups } from '../app/navigation'
import { useOrders } from '../features/orders/useOrders'
import { useApiOnline } from '../shared/api/health'

/** Nội dung thanh điều hướng; dùng chung cho sidebar (máy tính) và ngăn kéo (điện thoại). */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const apiOnline = useApiOnline()
  const { data: orders = [] } = useOrders()
  const pendingCount = orders.filter((order) => order.status === 'Chờ xác nhận').length

  const items: MenuProps['items'] = navGroups.map((group) => ({
    type: 'group',
    key: group.label,
    label: group.label,
    children: group.items.map(({ path, label, icon: Icon }) => ({
      key: path,
      icon: <Icon size={18} strokeWidth={1.8} />,
      label: (
        <span className="af-menu-label">
          {label}
          {path === '/orders' && pendingCount > 0 && <Badge count={pendingCount} size="small" color="#d9480f" title={`${pendingCount} đơn chờ xác nhận`} />}
        </span>
      ),
    })),
  }))

  return (
    <div className="af-nav">
      <div className="af-brand">
        <span className="af-brand-mark">
          <Waves size={18} strokeWidth={2.2} />
        </span>
        <div>
          <strong>AquaFlow</strong>
          <small>Chi nhánh chính</small>
        </div>
      </div>
      <Menu
        mode="inline"
        items={items}
        selectedKeys={[location.pathname]}
        onClick={({ key }) => {
          navigate(key)
          onNavigate?.()
        }}
        className="af-menu"
      />
      <div className="af-sider-footer">
        <div className={`af-api-status ${apiOnline ? 'online' : 'offline'}`}>
          <i />
          {apiOnline === undefined ? 'Đang kiểm tra kết nối' : apiOnline ? 'Đã kết nối máy chủ' : 'Đang dùng dữ liệu mẫu'}
        </div>
        <button className="af-sider-link" onClick={() => message.info('Cài đặt cửa hàng sẽ được bổ sung trong giai đoạn tiếp theo.')}>
          <Settings2 size={18} strokeWidth={1.8} /> Cài đặt
        </button>
        <div className="af-user">
          <Avatar className="af-avatar">NA</Avatar>
          <div>
            <strong>Nguyễn An</strong>
            <small>Quản trị viên</small>
          </div>
        </div>
      </div>
    </div>
  )
}
