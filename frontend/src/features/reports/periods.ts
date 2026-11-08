import dayjs, { type Dayjs } from 'dayjs'
import { shortDate } from '@/shared/utils/format'
import type { DailyRevenue, ReportRange } from './reportService'

export type ReportPreset = { label: string; value: [Dayjs, Dayjs] }

/** Các kỳ chọn nhanh; kỳ đang diễn ra tính tới hôm nay. Tính lại mỗi lần gọi để mở qua đêm vẫn đúng ngày. */
export function reportPresets(now: Dayjs = dayjs()): ReportPreset[] {
  const lastMonth = now.startOf('month').subtract(1, 'month')
  const quarter = now.startOf('year').month(now.month() - (now.month() % 3))
  const lastYear = now.startOf('year').subtract(1, 'year')
  return [
    { label: 'Hôm nay', value: [now, now] },
    { label: '7 ngày qua', value: [now.subtract(6, 'day'), now] },
    { label: '30 ngày qua', value: [now.subtract(29, 'day'), now] },
    { label: 'Tháng này', value: [now.startOf('month'), now] },
    { label: 'Tháng trước', value: [lastMonth, lastMonth.endOf('month')] },
    { label: 'Quý này', value: [quarter, now] },
    { label: 'Quý trước', value: [quarter.subtract(3, 'month'), quarter.subtract(1, 'day')] },
    { label: 'Năm nay', value: [now.startOf('year'), now] },
    { label: 'Năm trước', value: [lastYear, lastYear.endOf('year')] },
  ]
}

export type Granularity = 'day' | 'week' | 'month'

export const granularityLabels: Record<Granularity, string> = { day: 'Ngày', week: 'Tuần', month: 'Tháng' }

const dayCount = ({ from, to }: ReportRange) => Math.round((Date.parse(`${to}T00:00:00`) - Date.parse(`${from}T00:00:00`)) / 86_400_000) + 1

/** Kỳ ngắn xem theo ngày; kỳ dài gom lại để biểu đồ không quá dày. */
export const autoGranularity = (range: ReportRange): Granularity => {
  const days = dayCount(range)
  return days <= 31 ? 'day' : days <= 92 ? 'week' : 'month'
}

/** Thứ Hai đầu tuần của ngày "yyyy-mm-dd". */
const weekStart = (isoDate: string) => {
  const date = new Date(`${isoDate}T00:00:00`)
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export type RevenueBucket = { key: string; label: string; title: string; revenue: number; collected: number }

/** Gom doanh thu và tiền thu theo ngày thành từng tuần hoặc tháng. Tuần/tháng đầu và cuối có thể không đủ ngày. */
export function groupRevenue(days: DailyRevenue[], granularity: Granularity): RevenueBucket[] {
  const buckets = new Map<string, RevenueBucket>()
  for (const day of days) {
    const key = granularity === 'day' ? day.date : granularity === 'week' ? weekStart(day.date) : day.date.slice(0, 7)
    const [year, month] = key.split('-')
    const label =
      granularity === 'day' ? shortDate(day.date).slice(3) : granularity === 'week' ? shortDate(key).slice(3) : `T${Number(month)}/${year}`
    const title =
      granularity === 'day' ? shortDate(day.date) : granularity === 'week' ? `Tuần từ ${shortDate(key)}` : `Tháng ${Number(month)}/${year}`
    const bucket = buckets.get(key) ?? { key, label, title, revenue: 0, collected: 0 }
    bucket.revenue += day.revenue
    bucket.collected += day.collected
    buckets.set(key, bucket)
  }
  return [...buckets.values()]
}
