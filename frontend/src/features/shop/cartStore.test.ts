// @vitest-environment jsdom
import { beforeEach, expect, test } from 'vitest'
import { carts, clearShopData, forgetSavedProfile, readProfile, saveProfile } from './cartStore'

const profile = { customer: 'Khách A', phone: '0900000001', address: '99 Nhà A', area: 'Quận A' }

beforeEach(() => {
  clearShopData()
  saveProfile(profile)
  carts.live.actions.add('1', 2)
  carts.demo.actions.add('2', 1)
})

test('đăng xuất xóa thông tin giao hàng và cả hai giỏ, trên máy lẫn trong bộ nhớ', () => {
  clearShopData()
  expect(readProfile()).toBeNull()
  expect(carts.live.getSnapshot()).toEqual([])
  expect(carts.demo.getSnapshot()).toEqual([])
  expect(JSON.stringify({ ...localStorage })).not.toContain('Khách A')
})

test('hết phiên chỉ bỏ thông tin cá nhân, giữ giỏ để đặt tiếp', () => {
  forgetSavedProfile()
  expect(readProfile()).toBeNull()
  expect(carts.live.getSnapshot()).toEqual([{ productId: '1', quantity: 2 }])
})
