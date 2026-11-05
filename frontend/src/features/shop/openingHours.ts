import type { Dayjs } from 'dayjs'

/** Khung giờ tính bằng phút từ 0:00. */
export type OpeningHours = { open: number; close: number }

// Giờ mở cửa do cửa hàng ghi tự do. Bắt buộc có dấu giờ ("6:00", "6h") để "Thứ 2 - 6" không bị đọc nhầm thành giờ.
const RANGE = /(\d{1,2})\s*[:hg]\s*(\d{2})?\s*(?:–|—|-|đến|tới)\s*(\d{1,2})\s*[:hg]\s*(\d{2})?/i

/** Đọc khung giờ trong cùng một ngày; không đọc chắc chắn được thì trả null và không giới hạn giờ hẹn. */
export function parseOpeningHours(text?: string | null): OpeningHours | null {
  const match = text?.match(RANGE)
  if (!match) return null
  const [openHour, openMinute, closeHour, closeMinute] = [match[1], match[2] ?? '0', match[3], match[4] ?? '0'].map(Number)
  if (openHour > 23 || closeHour > 24 || openMinute > 59 || closeMinute > 59) return null
  const open = openHour * 60 + openMinute
  const close = closeHour * 60 + closeMinute
  return open < close && close <= 24 * 60 ? { open, close } : null
}

export const isWithinOpeningHours = (value: Dayjs, hours: OpeningHours) => {
  const minutes = value.hour() * 60 + value.minute()
  return minutes >= hours.open && minutes <= hours.close
}

const clock = (minutes: number) => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`
export const formatOpeningHours = (hours: OpeningHours) => `${clock(hours.open)} – ${clock(hours.close)}`

const numbers = (count: number) => Array.from({ length: count }, (_, index) => index)

/** Khóa các giờ ngoài khung trên lịch chọn giờ. */
export const disabledOutsideHours = (hours: OpeningHours) => ({
  disabledHours: () => numbers(24).filter((hour) => hour * 60 + 59 < hours.open || hour * 60 > hours.close),
  disabledMinutes: (hour: number) =>
    numbers(60).filter((minute) => {
      const value = hour * 60 + minute
      return value < hours.open || value > hours.close
    }),
})
