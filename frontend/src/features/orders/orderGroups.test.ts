import { expect, test } from 'vitest'
import { orderStatuses } from './orderStatus'
import { groupOfStatus, inOrderGroup, orderGroups, statusesInGroup } from './orderGroups'

test('mỗi trạng thái thuộc đúng một nhóm việc, đơn hủy chỉ ở "Tất cả"', () => {
  for (const status of orderStatuses) {
    const groups = orderGroups.filter((group) => group.key !== 'all' && inOrderGroup(group.key, status))
    expect(groups.length).toBe(status === 'Đã hủy' ? 0 : 1)
    expect(inOrderGroup('all', status)).toBe(true)
  }
  expect(groupOfStatus('Chờ xác nhận')).toBe('need')
  expect(groupOfStatus('Giao thất bại')).toBe('need')
  expect(groupOfStatus('Đang chuẩn bị')).toBe('active')
  expect(groupOfStatus('Đã hoàn tất')).toBe('done')
  expect(groupOfStatus('Đã hủy')).toBe('all')
})

test('ô lọc trạng thái chỉ có trạng thái của nhóm mà nguồn dữ liệu đang dùng', () => {
  const live = orderStatuses.filter((status) => status !== 'Giao thất bại')
  expect(statusesInGroup('need', live)).toEqual(['Chờ xác nhận'])
  expect(statusesInGroup('active', live)).toEqual(['Đã xác nhận', 'Đang chuẩn bị', 'Đang giao'])
  expect(statusesInGroup('all', live)).toEqual(live)
})
