import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App as AntApp, ConfigProvider } from 'antd'
import viVN from 'antd/locale/vi_VN'
import { BrowserRouter } from 'react-router'
import { appTheme } from './theme'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
})

/** Gom các provider dùng chung: dữ liệu (React Query), giao diện (Ant Design), điều hướng (Router). */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={viVN} theme={appTheme}>
        <AntApp message={{ maxCount: 3 }}>
          <BrowserRouter>{children}</BrowserRouter>
        </AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  )
}
