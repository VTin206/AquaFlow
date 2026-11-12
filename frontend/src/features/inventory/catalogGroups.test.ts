import { describe, expect, it } from 'vitest'
import { sortCategoryNames, suggestFromName } from './catalogGroups'

describe('bộ lọc loại sản phẩm', () => {
  it('mỗi tên một lần, theo thứ tự cửa hàng tạo loại, chưa phân loại xuống cuối', () => {
    expect(
      sortCategoryNames([
        { name: 'Nước có ga', id: 5 },
        { name: 'Chưa phân loại' },
        { name: 'Tinh khiết', id: 1 },
        { name: 'Nước có ga', id: 5 },
        { name: 'Nước tăng lực', id: 9 },
      ]),
    ).toEqual(['Tinh khiết', 'Nước có ga', 'Nước tăng lực', 'Chưa phân loại'])
  })
})

describe('gợi ý từ tên sản phẩm', () => {
  it('nhận thương hiệu theo nhóm đã biết, dung tích và loại đoán được', () => {
    expect(suggestFromName('Nước tinh khiết LaVie 19L (Úp)', 'Bình')).toEqual({ brand: 'LaVie', volumeMl: 19000, category: 'Tinh khiết' })
    expect(suggestFromName('Nước ion kiềm ion Life 500ml', 'Thùng')).toEqual({ brand: 'ion Life', volumeMl: 500, category: 'Ion kiềm' })
  })

  it('không nhận ra thì để trống, không đoán bừa', () => {
    expect(suggestFromName('Nước uống đóng chai', 'Chai')).toEqual({ brand: undefined, volumeMl: undefined, category: undefined })
    // Chỉ khớp nguyên từ: "Lavien" không phải LaVie.
    expect(suggestFromName('Nước Lavien', 'Chai').brand).toBeUndefined()
  })
})
