import type { ThemeConfig } from 'antd'

// Design token dùng chung cho Ant Design. Đổi màu/font toàn app tại đây.
export const appTheme: ThemeConfig = {
  token: {
    fontFamily: "'Be Vietnam Pro', system-ui, -apple-system, 'Segoe UI', sans-serif",
    fontSize: 14,
    colorPrimary: '#0b7a83',
    colorInfo: '#0b7a83',
    colorSuccess: '#2b8a3e',
    colorWarning: '#d9480f',
    colorError: '#c92a2a',
    colorText: '#1d2939',
    colorTextSecondary: '#475467',
    colorTextTertiary: '#667085',
    colorBorder: '#d0d5dd',
    colorBorderSecondary: '#eaecf0',
    colorBgLayout: '#f5f7f9',
    borderRadius: 8,
    controlHeight: 36,
  },
  components: {
    Layout: { siderBg: '#ffffff', headerBg: '#ffffff', bodyBg: '#f5f7f9' },
    Menu: { itemBorderRadius: 8, itemSelectedBg: '#e7f3f4', itemSelectedColor: '#0b7a83', itemColor: '#344054', groupTitleColor: '#667085' },
    Table: { headerBg: '#f9fafb', headerColor: '#475467', rowHoverBg: '#f5fafa' },
  },
}
