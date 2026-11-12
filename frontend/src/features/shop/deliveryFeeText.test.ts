import { describe, expect, it } from 'vitest'
import { baseFeeText, stairsFeeText } from './deliveryFeeText'

// Intl vi-VN dùng dấu chấm nhóm nghìn và khoảng trắng không ngắt trước ₫: so khớp sau khi chuẩn hóa khoảng trắng.
const plain = (text: string) => text.replace(/\s/g, ' ')

describe('baseFeeText', () => {
  it('follows the store threshold and fee', () => {
    expect(plain(baseFeeText({ freeFromUnits: 3, smallOrderFee: 15000 }))).toBe('Dưới 3 sản phẩm: 15.000 ₫ · Từ 3 sản phẩm: miễn phí')
    expect(plain(baseFeeText({ freeFromUnits: 5, smallOrderFee: 20000 }))).toBe('Dưới 5 sản phẩm: 20.000 ₫ · Từ 5 sản phẩm: miễn phí')
  })

  it('says free when every order ships free', () => {
    expect(baseFeeText({ freeFromUnits: 3, smallOrderFee: 0 })).toBe('Miễn phí')
    expect(baseFeeText({ freeFromUnits: 1, smallOrderFee: 15000 })).toBe('Miễn phí')
    expect(baseFeeText({ freeFromUnits: 0, smallOrderFee: 15000 })).toBe('Miễn phí')
  })
})

describe('stairsFeeText', () => {
  it('lists each floor and uses the last value from that floor up', () => {
    expect(plain(stairsFeeText([2000, 4000, 8000, 12000]))).toBe(
      'Lầu 1: 2.000 ₫ · Lầu 2: 4.000 ₫ · Lầu 3: 8.000 ₫ · Từ lầu 4: 12.000 ₫ mỗi bình/thùng. Chai, lon lẻ không tính.',
    )
  })

  it('groups neighbouring floors with the same fee', () => {
    expect(plain(stairsFeeText([1000, 1000, 7000]))).toBe('Lầu 1–2: 1.000 ₫ · Từ lầu 3: 7.000 ₫ mỗi bình/thùng. Chai, lon lẻ không tính.')
    expect(plain(stairsFeeText([5000, 5000]))).toBe('Từ lầu 1: 5.000 ₫ mỗi bình/thùng. Chai, lon lẻ không tính.')
    expect(plain(stairsFeeText([0, 3000]))).toBe('Lầu 1: miễn phí · Từ lầu 2: 3.000 ₫ mỗi bình/thùng. Chai, lon lẻ không tính.')
  })

  it('says there is no surcharge when every floor is free', () => {
    expect(stairsFeeText([0, 0, 0])).toBe('Không tính phụ thu')
    expect(stairsFeeText([])).toBe('Không tính phụ thu')
  })
})
