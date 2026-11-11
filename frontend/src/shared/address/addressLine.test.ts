import { expect, test } from 'vitest'
import { joinAddressLine, splitAddressLine } from './addressLine'

test('tách địa chỉ mới thành số nhà/đường và phường/xã, bỏ đuôi thành phố', () => {
  expect(splitAddressLine('12 Lê Lợi, Phường Bến Thành')).toEqual({ street: '12 Lê Lợi', ward: 'Phường Bến Thành' })
  expect(splitAddressLine('5 Hẻm 3, Đường 7, Phường Tân Định, TP. Hồ Chí Minh')).toEqual({ street: '5 Hẻm 3, Đường 7', ward: 'Phường Tân Định' })
  expect(splitAddressLine('Phường Sài Gòn')).toEqual({ street: '', ward: 'Phường Sài Gòn' })
})

test('địa chỉ cũ theo quận giữ nguyên, không mất chữ', () => {
  expect(splitAddressLine('26 Đường số 3, Gò Vấp, TP. Hồ Chí Minh')).toEqual({ street: '26 Đường số 3, Gò Vấp, TP. Hồ Chí Minh', ward: '' })
  expect(splitAddressLine('')).toEqual({ street: '', ward: '' })
  expect(splitAddressLine('8 Đại lộ Bình Dương, Phường Thủ Dầu Một')).toEqual({ street: '8 Đại lộ Bình Dương, Phường Thủ Dầu Một', ward: '' })
})

test('ghép lại đúng chuỗi một dòng', () => {
  expect(joinAddressLine(' 12 Lê Lợi ', 'Phường Bến Thành')).toBe('12 Lê Lợi, Phường Bến Thành')
  expect(joinAddressLine('12 Lê Lợi', '')).toBe('12 Lê Lợi')
  expect(joinAddressLine('', 'Phường Bến Thành')).toBe('Phường Bến Thành')
})
