import { expect, test } from 'vitest'
import { accountDestination, isSignedInOnlyPage, loginReturnState } from './accountAccess'

const customer = { name: 'Khách', role: 'CUSTOMER' }

test('khách đăng nhập xong quay lại đúng trang cửa hàng đang xem, kể cả bộ lọc', () => {
  expect(accountDestination(customer, '/shop/drinks?brand=LaVie')).toBe('/shop/drinks?brand=LaVie')
  expect(accountDestination(customer, '/shop/products/P-1')).toBe('/shop/products/P-1')
  expect(accountDestination(customer, '/shop/news/binh-up')).toBe('/shop/news/binh-up')
  expect(accountDestination(customer, '/track/abc123')).toBe('/track/abc123')
  expect(accountDestination(customer, '/checkout')).toBe('/checkout')
  expect(accountDestination(customer, '/shop')).toBe('/shop')
  // Trang đăng ký, trang quản lý hay địa chỉ ngoài thì không quay lại.
  expect(accountDestination(customer, '/shop/register')).toBe('/shop/orders')
  expect(accountDestination(customer, '/orders')).toBe('/shop/orders')
  expect(accountDestination(customer, '//example.com/shop')).toBe('/shop/orders')
})

test('mở trang đăng nhập mang theo trang đang xem; đang ở trang đăng nhập/đăng ký thì giữ trang gốc', () => {
  expect(loginReturnState({ pathname: '/shop/drinks', search: '?q=lavie' })).toEqual({ from: '/shop/drinks?q=lavie' })
  expect(loginReturnState({ pathname: '/shop/register', search: '', state: { from: '/shop/products/P-1' } })).toEqual({
    from: '/shop/products/P-1',
  })
  expect(loginReturnState({ pathname: '/shop/account', search: '', state: null })).toBeUndefined()
})

test('chỉ đơn hàng của tôi là trang phải rời đi khi đăng xuất', () => {
  expect(isSignedInOnlyPage('/shop/orders')).toBe(true)
  expect(isSignedInOnlyPage('/shop/orders/12')).toBe(true)
  expect(isSignedInOnlyPage('/shop/drinks')).toBe(false)
  expect(isSignedInOnlyPage('/shop/account')).toBe(false)
})
