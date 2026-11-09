/**
 * Bảng màu duy nhất của app: theme Ant Design (theme.ts) và biến CSS `--af-*` (dùng trong các file .css) đều lấy từ đây.
 * Tên khóa camelCase thành biến CSS kebab-case: `textStrong` → `--af-text-strong`.
 */
const light = {
  primary: '#087fad',
  primarySoft: '#eaf5fb',
  text: '#334155',
  textStrong: '#1e293b',
  textSecondary: '#64748b',
  textTertiary: '#94a3b8',
  border: '#e2e8f0',
  bg: '#f8fafc',
  warning: '#b45309',
  danger: '#dc2626',
  success: '#15803d',
  // Màu tiền: xem shared/components/Money.tsx.
  moneyDue: '#b45309',
  moneyPaid: '#15803d',
  moneyRefund: '#dc2626',
  moneyDeposit: '#087fad',
  // Màu nhấn cho những thứ cần chú ý: đơn mới, số đếm khẩn.
  accent: '#f97316',
  accentSoft: '#fff7ed',
  // Bề mặt: nền thẻ/ô, nền nhạt, nền chìm (ô đếm, cột bảng giao).
  surface: '#fff',
  surfaceMuted: '#f8fafc',
  surfaceHover: '#f2f4f7',
  surfaceSunken: '#f1f5f9',
  borderStrong: '#cbd5e1',
  // Thanh trên cùng và chân trang cửa hàng.
  chrome: '#ffffff',
  // Chữ/nút trắng đặt trên nền màu thương hiệu; giữ trắng ở mọi chế độ.
  onPrimary: '#fff',
  // Khung ảnh sản phẩm, logo, QR: ảnh có nền trắng nên khung luôn trắng.
  imageBg: '#fff',
  brandDeep: '#0a5f8f',
  brandLight: '#36b3dc',
  chartBar: '#b9deee',
  chartBarHover: '#81c2df',
  shadowChrome: '#1e293b12',
  shadowPrimary: '#087fad26',
  shadowCard: '#1e293b12',
  // Chỉ dùng cho component Ant Design.
  successSolid: '#16a34a',
  controlBorder: '#cbd5e1',
  sider: '#ffffff',
  menuHover: '#f4f7fb',
  rowHover: '#f2f9fc',
  segmentTrack: '#f0f4f8',
  segmentSelected: '#ffffff',
  selectedText: '#087fad',
}

export type Palette = typeof light

// Chế độ tối (khu quản lý, màn hình tài xế): ảnh, QR và màu thương hiệu giữ nguyên.
const dark: Palette = {
  ...light,
  primary: '#3aa6d6',
  primarySoft: '#13213a',
  text: '#cbd5e1',
  textStrong: '#f1f5f9',
  textSecondary: '#94a3b8',
  textTertiary: '#64748b',
  border: '#273449',
  bg: '#0f172a',
  warning: '#fbbf24',
  danger: '#f87171',
  success: '#4ade80',
  moneyDue: '#fbbf24',
  moneyPaid: '#4ade80',
  moneyRefund: '#f87171',
  moneyDeposit: '#5bb8e3',
  accent: '#fb923c',
  accentSoft: '#431407',
  surface: '#111c31',
  surfaceMuted: '#17233a',
  surfaceHover: '#1e2d46',
  surfaceSunken: '#0b1220',
  borderStrong: '#334155',
  chrome: '#0b1220',
  chartBar: '#24597a',
  chartBarHover: '#3a7fa8',
  shadowChrome: '#0008',
  shadowPrimary: '#0008',
  shadowCard: '#0006',
  successSolid: '#22c55e',
  controlBorder: '#334155',
  sider: '#0b1220',
  menuHover: '#17233a',
  rowHover: '#16243b',
  segmentTrack: '#0b1220',
  segmentSelected: '#1e2d46',
  selectedText: '#5bb8e3',
}

export const palettes = { light, dark }

const toCssVars = (palette: Palette, base?: Palette) =>
  Object.entries(palette)
    .filter(([key, value]) => !base || base[key as keyof Palette] !== value)
    .map(([key, value]) => `--af-${key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}: ${value};`)
    .join(' ')

/** Gắn biến CSS màu vào <head> trước khi render; chế độ tối chỉ ghi lại những màu khác bản sáng. */
export function installPaletteVars() {
  const style = document.createElement('style')
  style.id = 'af-palette'
  style.textContent = `:root { ${toCssVars(light)} }\n:root[data-theme="dark"] { color-scheme: dark; ${toCssVars(dark, light)} }`
  document.head.prepend(style)
}
