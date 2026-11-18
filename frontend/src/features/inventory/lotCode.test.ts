import { expect, test } from 'vitest'
import { suggestLotCode } from './lotCode'

test('ghép mã hàng với ngày nhận dạng ddmmyy', () => {
  expect(suggestLotCode('SATORI-19L', '2026-11-16')).toBe('SATORI-19L-161126')
  expect(suggestLotCode(' LV19 ', '2027-01-05')).toBe('LV19-050127')
})

test('thiếu mã hàng hoặc ngày nhận thì không gợi ý', () => {
  expect(suggestLotCode(undefined, '2026-11-16')).toBe('')
  expect(suggestLotCode('SATORI-19L', undefined)).toBe('')
  expect(suggestLotCode('SATORI-19L', '16/11/2026')).toBe('')
})
