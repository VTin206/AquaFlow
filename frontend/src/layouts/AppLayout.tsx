import { Suspense, useState } from 'react'
import { Drawer, Layout, Spin } from 'antd'
import { Outlet } from 'react-router'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function AppLayout() {
  const [navOpen, setNavOpen] = useState(false)

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
