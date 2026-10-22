import { App, Badge, Menu, type MenuProps } from 'antd'
import { Droplets, LifeBuoy, Settings2 } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import { navGroups } from '../app/navigation'
import { canOpen } from '../features/auth/permissions'
import { useStaff } from '../features/auth/useStaff'
import { useOrders } from '../features/orders/useOrders'
import { useSettings } from '../features/settings/settingsService'

/** Menu điều hướng; dùng chung cho sidebar (máy tính) và ngăn kéo (điện thoại). */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const staff = useStaff()
  const { data: orders = [] } = useOrders(Boolean(staff?.isDemo))
  const { data: settings } = useSettings(Boolean(staff?.isDemo))
  const allowed = (path: string) => (!staff?.isDemo && !['/products', '/suppliers', '/customers'].includes(path))
    ? false : !staff || canOpen(staff.role, path)
  const pendingCount = staff?.isDemo ? orders.filter((order) => order.status === 'Chờ xác nhận').length : 0

  const items: MenuProps['items'] = navGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => allowed(item.path)) }))
    .filter((group) => group.items.length)
    .map((group) => ({
      type: 'group' as const,
      key: group.label,
      label: group.label,
      children: group.items.map(({ path, label, icon: Icon }) => ({
        key: path,
        icon: <Icon size={18} strokeWidth={1.8} />,
        label: (
          <span className="af-menu-label">
            {label}
            {path === '/orders' && pendingCount > 0 && <Badge count={pendingCount} size="small" color="#087fad" title={`${pendingCount} đơn chờ xác nhận`} />}
          </span>
        ),
      })),
    }))

  return (
    <div className="af-nav">
      <div className="af-workspace">
        <span className="af-workspace-icon">
          <Droplets size={20} />
        </span>
        <div>
          <strong className="af-cell-truncate" title={staff?.isDemo ? settings?.storeName : undefined}>{staff?.isDemo ? settings?.storeName ?? 'Cửa hàng của bạn' : 'Cửa hàng của bạn'}</strong>
          <small>Quản lý đại lý nước</small>
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
        {allowed('/settings') && (
          <button
            className={`af-sider-link${location.pathname === '/settings' ? ' is-active' : ''}`}
            aria-current={location.pathname === '/settings' ? 'page' : undefined}
            onClick={() => {
              navigate('/settings')
              onNavigate?.()
            }}
          >
            <Settings2 size={18} strokeWidth={1.8} /> Cài đặt
          </button>
        )}
        <button className="af-sider-link" onClick={() => message.info('Hướng dẫn sử dụng sẽ được bổ sung.')}>
          <LifeBuoy size={18} strokeWidth={1.8} /> Trợ giúp
        </button>
      </div>
    </div>
  )
}
