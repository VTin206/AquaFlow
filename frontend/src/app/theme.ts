import { theme, type ThemeConfig } from 'antd'
import { palettes, type Palette } from './palette'
import { fontSizes as fs } from './typography'

// Design token dùng chung cho Ant Design; màu lấy từ palette.ts (cùng nguồn với biến CSS --af-*). Đổi font, bo góc, kích thước tại đây.
const buildTheme = (p: Palette): ThemeConfig => ({
  token: {
    fontFamily: "'Nunito Sans', 'Be Vietnam Pro', system-ui, -apple-system, 'Segoe UI', sans-serif",
    fontSize: fs.base,
    fontSizeSM: fs.sm,
    fontSizeLG: fs.lg,
    fontSizeXL: fs['2xl'],
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
    borderRadius: 12,
    borderRadiusLG: 14,
    controlHeight: 42,
    controlHeightSM: 32,
  },
  components: {
    Breadcrumb: {
      fontSize: fs.md,
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
    // Khung menu bo 14, đệm 4 nên dòng bên trong bo 10 để hai góc khớp nhau.
    Dropdown: { borderRadiusSM: 10 },
    Card: { headerFontSize: fs.lg, headerHeight: 56, bodyPadding: 20, borderRadiusLG: 14 },
    Statistic: { titleFontSize: fs.md, contentFontSize: `clamp(${fs.xl}px, 2vw, ${fs['4xl']}px)` },
    Button: { borderRadius: 9, borderRadiusSM: 9, borderRadiusLG: 12, fontWeight: 600, primaryShadow: '0 5px 14px rgba(8, 127, 173, 0.18)', defaultShadow: 'none' },
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
    Form: { labelColor: p.text, labelFontSize: fs.md, verticalLabelPadding: '0 0 4px', itemMarginBottom: 14 },
    Modal: { titleFontSize: fs.xl },
  },
})

export const appTheme = buildTheme(palettes.light)

/** iOS tự phóng to khi chạm vào ô nhập có chữ dưới 16px; trên điện thoại cho ô nhập 16px. */
export const withTouchInputs = (t: ThemeConfig): ThemeConfig => ({
  ...t,
  components: {
    ...t.components,
    Input: { ...t.components?.Input, inputFontSize: fs.lg },
    InputNumber: { ...t.components?.InputNumber, inputFontSize: fs.lg },
    DatePicker: { ...t.components?.DatePicker, inputFontSize: fs.lg },
    Select: { ...t.components?.Select, fontSize: fs.lg },
  },
})

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
