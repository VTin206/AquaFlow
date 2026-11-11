import { describe, expect, it } from 'vitest'
import { pageLocally, pageParams } from './page'

const rows = [
  { name: 'Nguyễn Văn Đức', phone: '0901000001' },
  { name: 'Trần Thị Hoa', phone: '0901000002' },
  { name: 'Lê Văn Đức', phone: '0901000003' },
]

describe('phân trang bản dùng thử', () => {
  it('cắt trang và đếm tổng như BE', () => {
    expect(pageLocally(rows, { page: 1, size: 2 }, (row) => row.name)).toEqual({
      items: [rows[2]],
      page: 1,
      size: 2,
      total: 3,
      totalPages: 2,
    })
  })

  it('tìm không dấu theo tên hoặc số điện thoại trước khi cắt trang', () => {
    const byName = pageLocally(
      rows,
      { page: 0, size: 10, q: 'duc' },
      (row) => row.name,
      (row) => row.phone,
    )
    expect(byName.items.map((row) => row.name)).toEqual(['Nguyễn Văn Đức', 'Lê Văn Đức'])
    expect(
      pageLocally(
        rows,
        { page: 0, size: 10, q: '+84 901 000 002' },
        (row) => row.name,
        (row) => row.phone,
      ).items,
    ).toEqual([rows[1]])
  })

  it('không gửi từ khóa rỗng lên BE', () => {
    expect(pageParams({ page: 0, size: 20, q: '  ' })).toEqual({ page: 0, size: 20 })
    expect(pageParams({ page: 2, size: 8, q: ' Đức ' })).toEqual({ page: 2, size: 8, q: 'Đức' })
  })
})
