const DAY_MS = 24 * 60 * 60 * 1000

/** Số ngày còn lại tới hạn sử dụng dạng "dd/mm/yyyy"; null nếu sản phẩm không có hạn ("—"). */
export function daysUntilExpiry(expiry: string, today = new Date()): number | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(expiry)
  if (!match) return null
  const [, day, month, year] = match
  const expiryDate = new Date(Number(year), Number(month) - 1, Number(day))
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((expiryDate.getTime() - start.getTime()) / DAY_MS)
}

/** Ngưỡng cảnh báo hạn sử dụng (ngày). */
export const EXPIRY_WARNING_DAYS = 120
