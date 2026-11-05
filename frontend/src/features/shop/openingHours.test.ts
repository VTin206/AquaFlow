import dayjs from 'dayjs'
import { expect, test } from 'vitest'
import { disabledOutsideHours, formatOpeningHours, isWithinOpeningHours, parseOpeningHours } from './openingHours'

test('đọc được các cách ghi giờ mở cửa thường gặp', () => {
  expect(parseOpeningHours('6:00 – 21:00 hằng ngày')).toEqual({ open: 360, close: 1260 })
  expect(parseOpeningHours('6h - 21h30')).toEqual({ open: 360, close: 1290 })
  expect(parseOpeningHours('Thứ 2 - 6, 8:00 đến 17:00')).toEqual({ open: 480, close: 1020 })
})

test('không chắc chắn thì không giới hạn giờ', () => {
  for (const text of [undefined, null, '', 'Cả ngày', 'Thứ 2 - 6', '24/7', '22:00 - 6:00', '25:00 - 26:00', '6:99 - 21:00']) {
    expect(parseOpeningHours(text)).toBeNull()
  }
})

test('kiểm tra giờ và khóa giờ trên lịch theo khung mở cửa', () => {
  const hours = { open: 360, close: 1260 }
  const at = (time: string) => dayjs(`2030-12-05T${time}:00`)
  expect(isWithinOpeningHours(at('06:00'), hours)).toBe(true)
  expect(isWithinOpeningHours(at('21:00'), hours)).toBe(true)
  expect(isWithinOpeningHours(at('05:59'), hours)).toBe(false)
  expect(isWithinOpeningHours(at('21:01'), hours)).toBe(false)
  expect(formatOpeningHours(hours)).toBe('6:00 – 21:00')
  const disabled = disabledOutsideHours(hours)
  expect(disabled.disabledHours()).toEqual([0, 1, 2, 3, 4, 5, 22, 23])
  expect(disabled.disabledMinutes(21)).toHaveLength(59)
  expect(disabled.disabledMinutes(12)).toHaveLength(0)
})
