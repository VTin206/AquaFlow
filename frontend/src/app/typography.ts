/**
 * Thang cỡ chữ duy nhất của app (px): theme Ant Design (theme.ts) và biến CSS `--af-fs-*` (dùng trong các file .css) đều lấy từ đây.
 * Muốn chữ cả app to/nhỏ hơn thì sửa ở đây. Bản in (print.css) dùng pt nên không theo thang này.
 */
export const fontSizes = {
  /** Badge, chú thích rất nhỏ, nhãn trục biểu đồ. */
  xs: 12,
  /** Chữ phụ, thông tin thêm dưới dòng chính. */
  sm: 13,
  /** Nhãn form, breadcrumb, chữ trong bảng dày. */
  md: 14,
  /** Chữ thường (cỡ gốc). */
  base: 15,
  /** Tiêu đề card, chữ nhấn mạnh; ô nhập trên điện thoại (iOS phóng to khi dưới 16px). */
  lg: 16,
  /** Tiêu đề hộp thoại, tiêu đề khối. */
  xl: 18,
  /** Tiêu đề trang trên điện thoại, tổng tiền. */
  '2xl': 20,
  /** Tiêu đề trang, số liệu nổi bật. */
  '3xl': 22,
  /** Giá lớn, số liệu chính. */
  '4xl': 28,
  /** Số liệu ở khối giới thiệu cửa hàng. */
  '5xl': 34,
} as const

export type FontSizeStep = keyof typeof fontSizes

/** Gắn biến CSS cỡ chữ (`--af-fs-sm`, `--af-fs-2xl`…) vào <head> trước khi render. */
export function installTypographyVars() {
  const style = document.createElement('style')
  style.id = 'af-typography'
  style.textContent = `:root { ${Object.entries(fontSizes)
    .map(([step, px]) => `--af-fs-${step}: ${px}px;`)
    .join(' ')} }`
  document.head.prepend(style)
}
