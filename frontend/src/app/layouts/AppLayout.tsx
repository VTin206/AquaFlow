import { Suspense, useState } from 'react'
import { Drawer, Layout, Spin } from 'antd'
import { Navigate, Outlet, useLocation } from 'react-router'
import { canOpen, homeOf } from '@/features/auth/permissions'
import { useStaff } from '@/features/auth/useStaff'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useMockSession } from './useAccountMenu'

// Ghi nhớ sidebar thu gọn giữa các lần mở app.
const COLLAPSED_KEY = 'aquaflow.sider-collapsed'
const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

export function AppLayout() {
  const [navOpen, setNavOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const toggleCollapsed = () => {
    setCollapsed((value) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, value ? '0' : '1')
      } catch {
        // Không lưu được thì lần sau mở rộng như mặc định.
      }
      return !value
    })
  }
  const staff = useStaff()
  const { pathname } = useLocation()

  useMockSession(staff)

  // Mở trang không thuộc vai trò (gõ đường dẫn, đổi vai trò) thì về trang chính của vai trò đó.
  if (staff && !canOpen(staff.role, pathname)) return <Navigate to={homeOf(staff.role)} replace />

  return (
    <Layout className="af-shell">
      <Topbar onOpenNav={() => setNavOpen(true)} />
      <Layout>
        {/* Máy tính: menu cố định bên trái. Điện thoại/tablet (< 992px): ẩn, mở bằng nút ☰ trên thanh trên cùng. */}
        <Layout.Sider width={224} collapsedWidth={72} collapsed={collapsed} trigger={null} className="af-sider">
          <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
        </Layout.Sider>
        <Drawer
          open={navOpen}
          onClose={() => setNavOpen(false)}
          placement="left"
          size={260}
          title="AquaFlow"
          styles={{ body: { padding: 0 } }}
        >
          <Sidebar onNavigate={() => setNavOpen(false)} />
        </Drawer>
        <Layout.Content className="af-content">
          {/* Giữ khung app hiển thị trong lúc tải code của trang mới. */}
          <Suspense
            fallback={
              <div className="af-page-loading">
                <Spin size="large" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </Layout.Content>
      </Layout>
    </Layout>
  )
}
