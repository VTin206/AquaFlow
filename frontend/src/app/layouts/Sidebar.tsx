import type { ReactNode } from 'react'
import { App, Badge, Menu, Tooltip, type MenuProps } from 'antd'
import { CircleQuestionMark, Droplets, PanelLeftClose, PanelLeftOpen, Settings2, type LucideIcon } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import { navGroups } from '@/app/navigation'
import { canOpen } from '@/features/auth/permissions'
import { useStaff } from '@/features/auth/useStaff'
import { usePageSupported } from '@/shared/features'
import { useOrders } from '@/features/orders/useOrders'
import { useSettings } from '@/features/settings/settingsService'

type SidebarProps = {
  onNavigate?: () => void
  /** Thu gọn chỉ còn icon (máy tính); ngăn kéo trên điện thoại luôn mở rộng. */
  collapsed?: boolean
  onToggleCollapse?: () => void
}

/** Menu điều hướng; dùng chung cho sidebar (máy tính) và ngăn kéo (điện thoại). */
export function Sidebar({ onNavigate, collapsed = false, onToggleCollapse }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const staff = useStaff()
  const { data: orders = [] } = useOrders(Boolean(staff?.isDemo))
  const { data: settings } = useSettings(Boolean(staff?.isDemo))
  const supported = usePageSupported()
  const allowed = (path: string) => !staff || canOpen(staff.role, path)
  const pendingCount = staff?.isDemo ? orders.filter((order) => order.status === 'Chờ xác nhận').length : 0
  const storeName = staff?.isDemo ? settings?.storeName ?? 'Cửa hàng' : 'Cửa hàng'

  const groups = navGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => allowed(item.path)) }))
    .filter((group) => group.items.length)
  const toItem = ({ path, label, icon: Icon }: { path: string; label: string; icon: LucideIcon }) => {
    const pending = path === '/orders' && pendingCount > 0
    return {
      key: path,
      // Thu gọn thì nhãn ẩn vào tooltip, số đơn chờ chuyển thành chấm trên icon.
      icon: collapsed && pending ? <Badge dot color="var(--af-primary)"><Icon size={18} strokeWidth={1.8} /></Badge> : <Icon size={18} strokeWidth={1.8} />,
      label: (
        <span className="af-menu-label">
          {label}
          {pending && <Badge count={pendingCount} size="small" color="var(--af-primary)" title={`${pendingCount} đơn chờ xác nhận`} />}
          {!supported(path) && <small className="af-menu-soon">Chưa hỗ trợ</small>}
        </span>
      ),
    }
  }
  // Giữ nguyên nhóm ở cả hai chế độ để menu không vẽ lại khi thu gọn/mở rộng; tiêu đề nhóm co lại bằng CSS.
  const items: MenuProps['items'] = groups.map((group) => ({ type: 'group' as const, key: group.label, label: group.label, children: group.items.map(toItem) }))

  const footerLink = (label: string, icon: ReactNode, onClick: () => void, extra?: ReactNode, active = false) => (
    <Tooltip title={collapsed ? label : undefined} placement="right">
      <button className={`af-sider-link${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined} aria-label={collapsed ? label : undefined} onClick={onClick}>
        {icon}
        {!collapsed && <span className="af-sider-link-text">{label}{extra}</span>}
      </button>
    </Tooltip>
  )

  return (
    <div className={`af-nav${collapsed ? ' is-collapsed' : ''}`}>
      {/* Nút thu gọn nằm cố định ở đầu menu: cạnh tên cửa hàng khi mở rộng, dưới icon khi thu gọn. */}
      <div className="af-workspace">
        <Tooltip title={collapsed ? storeName : undefined} placement="right">
          <span className="af-workspace-icon">
            <Droplets size={20} />
          </span>
        </Tooltip>
        {!collapsed && (
          <div className="af-workspace-text">
            <strong className="af-cell-truncate" title={storeName}>{storeName}</strong>
            <small>Đại lý nước</small>
          </div>
        )}
        {onToggleCollapse && (
          <Tooltip title={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'} placement="right">
            <button type="button" className="af-sider-toggle" aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'} aria-expanded={!collapsed} onClick={onToggleCollapse}>
              {collapsed ? <PanelLeftOpen size={16} strokeWidth={1.8} /> : <PanelLeftClose size={16} strokeWidth={1.8} />}
            </button>
          </Tooltip>
        )}
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
        {allowed('/settings') &&
          footerLink(
            'Cài đặt',
            <Settings2 size={18} strokeWidth={1.8} />,
            () => {
              navigate('/settings')
              onNavigate?.()
            },
            !supported('/settings') && <small className="af-menu-soon">Chưa hỗ trợ</small>,
            location.pathname === '/settings',
          )}
        {footerLink('Trợ giúp', <CircleQuestionMark size={18} strokeWidth={1.8} />, () => message.info('Hướng dẫn sử dụng sẽ được bổ sung.'))}
      </div>
    </div>
  )
}
