/**
 * Bảng màu duy nhất của app: theme Ant Design (theme.ts) và biến CSS `--af-*` (dùng trong các file .css) đều lấy từ đây.
 * Tên khóa camelCase thành biến CSS kebab-case: `textStrong` → `--af-text-strong`.
 */
const light = {
  primary: '#087fad',
  primarySoft: '#eaf5fb',
  text: '#263e53',
  textStrong: '#16324f',
  textSecondary: '#52687b',
  textTertiary: '#687d8e',
  border: '#e7eef4',
  bg: '#f4f7fb',
  warning: '#b86b0a',
  danger: '#c34444',
  success: '#1f7a60',
  // Màu tiền: xem shared/components/Money.tsx.
  moneyDue: '#a65f08',
  moneyPaid: '#1f7a60',
  moneyRefund: '#c34444',
  moneyDeposit: '#087fad',
  // Màu nhấn cho những thứ cần chú ý: đơn mới, số đếm khẩn.
  accent: '#b86b0a',
  accentSoft: '#fff1dc',
  // Bề mặt: nền thẻ/ô, nền nhạt, nền chìm (ô đếm, cột bảng giao).
  surface: '#fff',
  surfaceMuted: '#f8fafc',
  surfaceHover: '#f2f4f7',
  surfaceSunken: '#eaf0f5',
  borderStrong: '#e1e9f1',
  // Thanh trên cùng và chân trang cửa hàng.
  chrome: '#f5fbfe',
  // Chữ/nút trắng đặt trên nền màu thương hiệu; giữ trắng ở mọi chế độ.
  onPrimary: '#fff',
  // Khung ảnh sản phẩm, logo, QR: ảnh có nền trắng nên khung luôn trắng.
  imageBg: '#fff',
  brandDeep: '#0a5f8f',
  brandLight: '#36b3dc',
  chartBar: '#b9deee',
  chartBarHover: '#81c2df',
  shadowChrome: '#087fad0a',
  shadowPrimary: '#087fad26',
  shadowCard: '#16324f03',
  // Chỉ dùng cho component Ant Design.
  successSolid: '#23856b',
  controlBorder: '#d6e2eb',
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
  textStrong: '#e2e8f0',
  textSecondary: '#94a3b8',
  textTertiary: '#718096',
  border: '#1c2333',
  bg: '#0a0f1a',
  warning: '#e2a03f',
  danger: '#f07171',
  success: '#4cc39a',
  moneyDue: '#e8a24a',
  moneyPaid: '#4cc39a',
  moneyRefund: '#f07171',
  moneyDeposit: '#5bb8e3',
  accent: '#e2a03f',
  accentSoft: '#3a2a12',
  surface: '#0f1626',
  surfaceMuted: '#121a2c',
  surfaceHover: '#151f33',
  surfaceSunken: '#0b111d',
  borderStrong: '#273042',
  chrome: '#080c15',
  chartBar: '#24597a',
  chartBarHover: '#3a7fa8',
  shadowChrome: '#0006',
  shadowPrimary: '#0006',
  shadowCard: '#0003',
  successSolid: '#4cc39a',
  controlBorder: '#273042',
  sider: '#080c15',
  menuHover: '#151f33',
  rowHover: '#131c30',
  segmentTrack: '#0b111d',
  segmentSelected: '#1a2640',
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
