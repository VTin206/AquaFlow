import { theme, type ThemeConfig } from 'antd'
import { palettes, type Palette } from './palette'

// Design token dùng chung cho Ant Design; màu lấy từ palette.ts (cùng nguồn với biến CSS --af-*). Đổi font, bo góc, kích thước tại đây.
const buildTheme = (p: Palette): ThemeConfig => ({
  token: {
    fontFamily: "'Be Vietnam Pro', system-ui, -apple-system, 'Segoe UI', sans-serif",
    fontSize: 14,
    colorPrimary: p.primary,
    colorInfo: p.primary,
    colorSuccess: p.successSolid,
    colorWarning: p.warning,
    colorError: p.danger,
    colorText: p.text,
    colorTextHeading: p.textStrong,
    colorTextSecondary: p.textSecondary,
    colorTextTertiary: p.textTertiary,
    colorBorder: p.controlBorder,
    colorBorderSecondary: p.border,
    colorBgLayout: p.bg,
    borderRadius: 10,
    borderRadiusLG: 14,
    controlHeight: 40,
    controlHeightSM: 30,
  },
  components: {
    Breadcrumb: {
      fontSize: 13,
      linkColor: p.textTertiary,
      linkHoverColor: p.primary,
      lastItemColor: p.textStrong,
      separatorColor: p.textTertiary,
    },
    Layout: { siderBg: p.sider, headerBg: p.sider, bodyBg: p.bg },
    Menu: {
      itemBorderRadius: 9,
      itemHeight: 44,
      itemSelectedBg: p.primarySoft,
      itemSelectedColor: p.selectedText,
      itemColor: p.textSecondary,
      itemHoverBg: p.menuHover,
      groupTitleColor: p.textTertiary,
      iconSize: 18,
      iconMarginInlineEnd: 12,
    },
    Card: { headerFontSize: 15, headerHeight: 50, bodyPadding: 18 },
    Statistic: { titleFontSize: 13, contentFontSize: 'clamp(18px, 2vw, 28px)' },
    Button: { fontWeight: 500, primaryShadow: '0 3px 8px rgba(8, 127, 173, 0.16)', defaultShadow: 'none' },
    Table: {
      headerBg: p.surfaceMuted,
      headerColor: p.textSecondary,
      headerSplitColor: 'transparent',
      rowHoverBg: p.rowHover,
      cellPaddingBlock: 10,
      cellPaddingBlockMD: 10,
      // Cùng lề với toolbar; bảng middle mặc định chỉ chừa 8px.
      cellPaddingInline: 20,
      cellPaddingInlineMD: 20,
    },
    Segmented: { trackBg: p.segmentTrack, itemSelectedColor: p.selectedText, itemSelectedBg: p.segmentSelected, trackPadding: 4 },
    Form: { labelColor: p.text, labelFontSize: 13, verticalLabelPadding: '0 0 4px', itemMarginBottom: 14 },
    Modal: { titleFontSize: 18 },
  },
})

export const appTheme = buildTheme(palettes.light)

// Chế độ tối: thuật toán tối của AntD + bảng màu tối trong palette.ts.
const darkBase = buildTheme(palettes.dark)
export const darkTheme: ThemeConfig = {
  ...darkBase,
  algorithm: theme.darkAlgorithm,
  token: { ...darkBase.token, colorBgContainer: palettes.dark.surface, colorBgElevated: palettes.dark.surfaceMuted },
  components: {
    ...darkBase.components,
    Menu: { ...darkBase.components?.Menu, itemBg: 'transparent' },
    Button: { ...darkBase.components?.Button, primaryShadow: 'none' },
  },
}
