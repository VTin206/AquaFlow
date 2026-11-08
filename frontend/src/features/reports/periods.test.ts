import dayjs from 'dayjs'
import { describe, expect, it } from 'vitest'
import { reportPresets } from './periods'

const rangeOf = (label: string, now: string) => {
  const preset = reportPresets(dayjs(now)).find((item) => item.label === label)
  return preset?.value.map((date) => date.format('YYYY-MM-DD'))
}

describe('reportPresets', () => {
  it('computes the current and previous quarter', () => {
    expect(rangeOf('Quý này', '2026-11-05')).toEqual(['2026-10-01', '2026-11-05'])
    expect(rangeOf('Quý trước', '2026-11-05')).toEqual(['2026-07-01', '2026-09-30'])
  })

  it('crosses the year boundary from the first quarter', () => {
    expect(rangeOf('Quý trước', '2026-02-15')).toEqual(['2025-10-01', '2025-12-31'])
  })

  it('handles month ends without overflowing into the next month', () => {
    expect(rangeOf('Quý này', '2026-05-31')).toEqual(['2026-04-01', '2026-05-31'])
    expect(rangeOf('Tháng trước', '2026-03-31')).toEqual(['2026-02-01', '2026-02-28'])
  })

  it('computes whole years within the 366-day report limit', () => {
    expect(rangeOf('Năm nay', '2026-11-05')).toEqual(['2026-01-01', '2026-11-05'])
    expect(rangeOf('Năm trước', '2025-01-10')).toEqual(['2024-01-01', '2024-12-31'])
  })
})
