import { describe, expect, it } from 'vitest'
import { catalogFromApi } from '@/features/inventory/catalogGroups'
import { describeActivity, refundAfterReturn, returnValue } from './orderReturnApi'

describe('nhận trả hàng', () => {
  it('chia giảm giá của đơn theo giá trị hàng trả, như BE', () => {
    // 2 × 20.000 trên đơn 100.000 giảm 10.000.
    expect(returnValue([{ quantity: 2, unitPrice: 20000 }], 100000, 10000)).toBe(36000)
    expect(returnValue([{ quantity: 1, unitPrice: 15000 }], 0, 0)).toBe(15000)
  })

  it('chỉ hoàn phần khách đã trả vượt giá trị còn lại của đơn', () => {
    expect(refundAfterReturn({ total: 90000, paid: 90000 }, 36000)).toBe(36000)
    expect(refundAfterReturn({ total: 90000, paid: 50000 }, 36000)).toBe(0)
    expect(refundAfterReturn({ total: 90000, paid: 60000 }, 36000)).toBe(6000)
    // Trả quá giá trị đơn (phí giao, làm tròn) không làm tổng âm.
    expect(refundAfterReturn({ total: 30000, paid: 30000 }, 36000)).toBe(30000)
  })
})

describe('nhật ký theo đơn', () => {
  it('đổi mã trạng thái BE ghi kèm sang tiếng Việt', () => {
    expect(describeActivity({ action: 'transitionStatus', description: 'Đổi trạng thái đơn → CONFIRMED' })).toBe(
      'Đổi trạng thái đơn → Đã xác nhận',
    )
    expect(describeActivity({ action: 'recordResult', description: 'Ghi kết quả giao hàng · đơn #12 · FAILED' })).toBe(
      'Ghi kết quả giao hàng · đơn #12 · Giao thất bại',
    )
    expect(describeActivity({ action: 'receive', description: null })).toBe('Nhận trả hàng')
  })
})

describe('loại nước và dung tích', () => {
  it('dùng giá trị đã lưu, field chưa nhập thì đoán từ tên', () => {
    expect(catalogFromApi({ name: 'Nước tinh khiết 500ml', unit: 'Thùng', waterType: 'ALKALINE', volumeMl: 350 })).toMatchObject({
      category: 'Ion kiềm',
      capacity: '250–355ml',
      volumeMl: 350,
    })
    expect(catalogFromApi({ name: 'Nước tinh khiết 500ml', unit: 'Thùng', waterType: null, volumeMl: null })).toMatchObject({
      category: 'Tinh khiết',
      capacity: '390–520ml',
      volumeMl: 500,
    })
  })
})
