import { expect, test } from 'vitest'
import { brandRows } from './brandRows'

test('gộp tên viết khác vào thương hiệu chuẩn và giữ thương hiệu gõ tự do', () => {
  const rows = brandRows([{ brand: 'Viva' }, { brand: 'LaVie' }, { brand: 'Nhãn mới' }, { brand: 'Chưa có thương hiệu' }])
  expect(rows[0]).toMatchObject({ name: 'LaVie', count: 2 })
  expect(rows.find((row) => row.name === 'Nhãn mới')).toMatchObject({ count: 1, aliases: [] })
  expect(rows.some((row) => row.name === 'Chưa có thương hiệu')).toBe(false)
})
