import dayjs from 'dayjs'

/** Bộ lọc "lâu chưa mua": số ngày tính từ đơn gần nhất, `never` là khách chưa có đơn nào. */
export type IdleFilter = 'all' | '7' | '14' | '30' | 'never'

export const idleOptions: { value: IdleFilter; label: string }[] = [
  { value: 'all', label: 'Mọi lần mua' },
  { value: '7', label: 'Chưa mua quá 7 ngày' },
  { value: '14', label: 'Chưa mua quá 14 ngày' },
  { value: '30', label: 'Chưa mua quá 30 ngày' },
  { value: 'never', label: 'Chưa mua lần nào' },
]

/** Số ngày lịch (không theo giờ) từ lần mua gần nhất tới hôm nay. */
export const daysSince = (at: string, now = dayjs()) => now.startOf('day').diff(dayjs(at).startOf('day'), 'day')

export function matchesIdle(lastOrderAt: string | undefined, filter: IdleFilter, now = dayjs()) {
  if (filter === 'all') return true
  if (filter === 'never') return !lastOrderAt
  return lastOrderAt !== undefined && daysSince(lastOrderAt, now) > Number(filter)
}

/** "Hôm nay", "Hôm qua", "5 ngày trước"; quá 30 ngày thì ghi ngày cụ thể. */
export function lastOrderLabel(lastOrderAt: string | undefined, now = dayjs()) {
  if (!lastOrderAt) return 'Chưa mua lần nào'
  const days = daysSince(lastOrderAt, now)
  if (days <= 0) return 'Hôm nay'
  if (days === 1) return 'Hôm qua'
  if (days <= 30) return `${days} ngày trước`
  return dayjs(lastOrderAt).format('DD/MM/YYYY')
}

/** Mốc mới nhất trong danh sách thời điểm ISO; rỗng thì undefined. */
export const latest = (dates: (string | undefined | null)[]) =>
  dates.reduce<string | undefined>((max, at) => (at && (!max || at > max) ? at : max), undefined)
