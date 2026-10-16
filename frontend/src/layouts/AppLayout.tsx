import { Suspense, useState } from 'react'
import { Button, Drawer, Layout, Spin } from 'antd'
import { Menu as MenuIcon } from 'lucide-react'
import { Outlet } from 'react-router'
import { Sidebar } from './Sidebar'

export function AppLayout() {
  const [navOpen, setNavOpen] = useState(false)

  return (
    <Layout className="af-shell">
      {/* Máy tính: sidebar cố định. Điện thoại/tablet (< 992px): ẩn, mở bằng nút ☰. */}
      <Layout.Sider width={240} className="af-sider">
        <Sidebar />
      </Layout.Sider>
      <Drawer open={navOpen} onClose={() => setNavOpen(false)} placement="left" size={260} closable={false} styles={{ body: { padding: 0 } }}>
        <Sidebar onNavigate={() => setNavOpen(false)} />
      </Drawer>

      <Layout>
        <Button className="af-nav-toggle" aria-label="Mở menu" icon={<MenuIcon size={18} />} onClick={() => setNavOpen(true)} />
        <Layout.Content className="af-content">
          {/* Giữ sidebar hiển thị trong lúc tải code của trang mới. */}
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
