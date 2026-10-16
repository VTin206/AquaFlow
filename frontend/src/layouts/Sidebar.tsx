import { App, Badge, Menu, type MenuProps } from 'antd'
import { LifeBuoy, Settings2 } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import { navGroups } from '../app/navigation'
import { useOrders } from '../features/orders/useOrders'

/** Menu điều hướng; dùng chung cho sidebar (máy tính) và ngăn kéo (điện thoại). */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { message } = App.useApp()
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
          {path === '/orders' && pendingCount > 0 && <Badge count={pendingCount} size="small" color="#e03131" title={`${pendingCount} đơn chờ xác nhận`} />}
        </span>
      ),
    })),
  }))

  return (
    <div className="af-nav">
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
        <button className="af-sider-link" onClick={() => message.info('Cài đặt cửa hàng sẽ được bổ sung trong giai đoạn tiếp theo.')}>
          <Settings2 size={18} strokeWidth={1.8} /> Cài đặt
        </button>
        <button className="af-sider-link" onClick={() => message.info('Hướng dẫn sử dụng sẽ được bổ sung.')}>
          <LifeBuoy size={18} strokeWidth={1.8} /> Trợ giúp
        </button>
      </div>
    </div>
  )
}
