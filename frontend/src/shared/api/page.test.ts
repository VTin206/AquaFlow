import { describe, expect, it } from 'vitest'
import { pageParams } from './page'

describe('pageParams', () => {
  it('không gửi từ khóa rỗng lên BE', () => {
    expect(pageParams({ page: 0, size: 20, q: '  ' })).toEqual({ page: 0, size: 20 })
    expect(pageParams({ page: 2, size: 8, q: ' Đức ' })).toEqual({ page: 2, size: 8, q: 'Đức' })
  })
})
