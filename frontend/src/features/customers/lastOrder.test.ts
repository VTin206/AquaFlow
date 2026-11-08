import dayjs from 'dayjs'
import { describe, expect, it } from 'vitest'
import { lastOrderLabel, latest, matchesIdle } from './lastOrder'

const now = dayjs('2026-11-06T15:00:00')

describe('lần mua gần nhất', () => {
  it('ghi theo ngày lịch, quá 30 ngày thì ghi ngày cụ thể', () => {
    expect(lastOrderLabel(undefined, now)).toBe('Chưa mua lần nào')
    expect(lastOrderLabel('2026-11-06T01:00:00', now)).toBe('Hôm nay')
    expect(lastOrderLabel('2026-11-05T23:59:00', now)).toBe('Hôm qua')
    expect(lastOrderLabel('2026-11-01T09:00:00', now)).toBe('5 ngày trước')
    expect(lastOrderLabel('2026-09-01T09:00:00', now)).toBe('01/09/2026')
  })

  it('lọc khách lâu chưa mua và khách chưa mua lần nào', () => {
    expect(matchesIdle('2026-10-29T10:00:00', '7', now)).toBe(true)
    expect(matchesIdle('2026-10-30T10:00:00', '7', now)).toBe(false)
    expect(matchesIdle(undefined, '7', now)).toBe(false)
    expect(matchesIdle(undefined, 'never', now)).toBe(true)
    expect(matchesIdle('2026-11-01T10:00:00', 'all', now)).toBe(true)
  })

  it('lấy mốc mới nhất, bỏ qua giá trị trống', () => {
    expect(latest(['2026-10-01T00:00:00Z', null, '2026-11-01T00:00:00Z', undefined])).toBe('2026-11-01T00:00:00Z')
    expect(latest([])).toBeUndefined()
  })
})
