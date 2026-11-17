import type { DeliveryTrip } from './deliveryApi'
import { liveTripStatus, type TripViewStatus } from './tripFocus'

/** Nhóm chuyến: việc cần làm tách khỏi chuyến đã xong để danh sách dài vẫn dễ theo dõi. */
export type TripGroup = 'settle' | 'running' | 'done' | 'all'
const groupStatuses: Record<Exclude<TripGroup, 'all'>, TripViewStatus[]> = {
  settle: ['Chờ đối soát'],
  running: ['Chờ xuất phát', 'Đang giao'],
  done: ['Đã đối soát', 'Đã hủy'],
}
export const tripGroupOf = (status: TripViewStatus): Exclude<TripGroup, 'all'> =>
  status === 'Chờ đối soát' ? 'settle' : groupStatuses.running.includes(status) ? 'running' : 'done'

/** Khoảng ngày tính theo lần hoạt động gần nhất của chuyến; chuyến chưa xong luôn hiện. */
export type TripRange = 'today' | '7' | '30' | 'all'
const rangeDays: Record<Exclude<TripRange, 'all'>, number> = { today: 0, '7': 7, '30': 30 }
const lastActivity = (trip: DeliveryTrip) => new Date(trip.endedAt ?? trip.startedAt ?? trip.createdAt)
export function inTripRange(trip: DeliveryTrip, range: TripRange, now = new Date()) {
  if (range === 'all' || tripGroupOf(liveTripStatus(trip)) !== 'done') return true
  const from = new Date(now)
  from.setHours(0, 0, 0, 0)
  from.setDate(from.getDate() - rangeDays[range])
  return lastActivity(trip) >= from
}
