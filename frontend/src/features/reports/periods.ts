import { shortDate } from '../../shared/utils/format'
import type { DailyRevenue, ReportRange } from './reportService'

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

export type RevenueBucket = { key: string; label: string; title: string; revenue: number }

/** Gom doanh thu theo ngày thành từng tuần hoặc tháng. Tuần/tháng đầu và cuối có thể không đủ ngày. */
export function groupRevenue(days: DailyRevenue[], granularity: Granularity): RevenueBucket[] {
  const buckets = new Map<string, RevenueBucket>()
  for (const day of days) {
    const key = granularity === 'day' ? day.date : granularity === 'week' ? weekStart(day.date) : day.date.slice(0, 7)
    const [year, month] = key.split('-')
    const label = granularity === 'day' ? shortDate(day.date).slice(3) : granularity === 'week' ? shortDate(key).slice(3) : `T${Number(month)}/${year}`
    const title = granularity === 'day' ? shortDate(day.date) : granularity === 'week' ? `Tuần từ ${shortDate(key)}` : `Tháng ${Number(month)}/${year}`
    const bucket = buckets.get(key) ?? { key, label, title, revenue: 0 }
    bucket.revenue += day.revenue
    buckets.set(key, bucket)
  }
  return [...buckets.values()]
}
