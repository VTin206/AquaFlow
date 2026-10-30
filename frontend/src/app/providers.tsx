import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App as AntApp, ConfigProvider } from 'antd'
import viVN from 'antd/locale/vi_VN'
import dayjs from 'dayjs'
import 'dayjs/locale/vi'
import { BrowserRouter } from 'react-router'
import { AuthProvider } from '../features/auth/AuthProvider'
import { appTheme } from './theme'

// Tên thứ/tháng tiếng Việt trong bộ chọn ngày.
dayjs.locale('vi')

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
})

// Dấu * đỏ đặt sau nhãn trường bắt buộc; ô nhập vẫn có aria-required nên trình đọc màn hình đọc được.
const requiredMark = (label: ReactNode, { required }: { required: boolean }) => (
  <>
    {label}
    {required && <span className="af-required-mark" aria-hidden>*</span>}
  </>
)

/** Gom các provider dùng chung: dữ liệu (React Query), giao diện (Ant Design), điều hướng (Router). */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={viVN} theme={appTheme} form={{ requiredMark }}>
        <AntApp message={{ maxCount: 3 }}>
          <AuthProvider>
            <BrowserRouter>{children}</BrowserRouter>
          </AuthProvider>
        </AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  )
}
