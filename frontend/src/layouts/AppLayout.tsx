import { Suspense, useEffect, useState } from 'react'
import { Drawer, Layout, Spin } from 'antd'
import { Navigate, Outlet, useLocation } from 'react-router'
import { canOpen, homeOf } from '../features/auth/permissions'
import { useStaff } from '../features/auth/useStaff'
import { setMockSession } from '../mocks/session'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function AppLayout() {
  const [navOpen, setNavOpen] = useState(false)
  const staff = useStaff()
  const { pathname } = useLocation()

  // Dữ liệu mẫu ghi tên và kiểm tra quyền theo nhân viên đang dùng, giống backend đọc từ JWT.
  const staffName = staff?.name
  const staffRole = staff?.role
  useEffect(() => {
    if (staffName && staffRole) setMockSession({ name: staffName, role: staffRole })
  }, [staffName, staffRole])

  // Mở trang không thuộc vai trò (gõ đường dẫn, đổi vai trò) thì về trang chính của vai trò đó.
  if (staff && !canOpen(staff.role, pathname)) return <Navigate to={homeOf(staff.role)} replace />
  if (staff && !staff.isDemo && pathname === '/' && staff.role !== 'DELIVERY_STAFF') return <Navigate to="/products" replace />

  return (
    <Layout className="af-shell">
      <Topbar onOpenNav={() => setNavOpen(true)} />
      <Layout>
        {/* Máy tính: menu cố định bên trái. Điện thoại/tablet (< 992px): ẩn, mở bằng nút ☰ trên thanh trên cùng. */}
        <Layout.Sider width={224} className="af-sider">
          <Sidebar />
        </Layout.Sider>
        <Drawer open={navOpen} onClose={() => setNavOpen(false)} placement="left" size={260} title="AquaFlow" styles={{ body: { padding: 0 } }}>
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
