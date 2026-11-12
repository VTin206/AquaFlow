// @vitest-environment jsdom
import { beforeEach, expect, test } from 'vitest'
import { clearShopData, forgetSavedProfile, readProfile, saveProfile, shopCart } from './cartStore'

const profile = { customer: 'Khách A', phone: '0900000001', address: '99 Nhà A', area: 'Quận A' }

beforeEach(() => {
  clearShopData()
  saveProfile(profile)
  shopCart.actions.add('1', 2)
})

test('đăng xuất xóa thông tin giao hàng và giỏ hàng, trên máy lẫn trong bộ nhớ', () => {
  clearShopData()
  expect(readProfile()).toBeNull()
  expect(shopCart.getSnapshot()).toEqual([])
  expect(JSON.stringify({ ...localStorage })).not.toContain('Khách A')
})

test('hết phiên chỉ bỏ thông tin cá nhân, giữ giỏ để đặt tiếp', () => {
  forgetSavedProfile()
  expect(readProfile()).toBeNull()
  expect(shopCart.getSnapshot()).toEqual([{ productId: '1', quantity: 2 }])
})
