import { useEffect, type ReactNode } from 'react'
import { App as AntApp, ConfigProvider, Grid } from 'antd'
import { useColorMode } from '@/app/colorMode'
import { appTheme, darkTheme, withTouchInputs } from '@/app/theme'

/**
 * Vùng theo chế độ sáng/tối (khu quản lý, màn hình tài xế); cửa hàng và đăng nhập luôn sáng.
 * `data-theme` đặt trên <html> để biến màu áp cả hộp thoại, menu render qua portal;
 * AntApp lồng bên trong để modal/message từ App.useApp() cũng nhận theme tối.
 */
export function ThemedArea({ children }: { children: ReactNode }) {
  const { dark } = useColorMode()
  const narrow = Grid.useBreakpoint().md === false
  useEffect(() => {
    const root = document.documentElement
    if (dark) root.dataset.theme = 'dark'
    else delete root.dataset.theme
    return () => {
      delete root.dataset.theme
    }
  }, [dark])
  return (
    <ConfigProvider theme={narrow ? withTouchInputs(dark ? darkTheme : appTheme) : dark ? darkTheme : appTheme}>
      <AntApp message={{ maxCount: 3 }}>{children}</AntApp>
    </ConfigProvider>
  )
}
