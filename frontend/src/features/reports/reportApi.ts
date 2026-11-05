import { api } from '@/shared/api/client'

export const channelLabels = { WEB: 'Website', COUNTER: 'Tại quầy', PHONE: 'Điện thoại', MESSAGE: 'Tin nhắn' }
export type ReportQuery = { from: string; to: string; channel?: keyof typeof channelLabels; method?: 'COUNTER' | 'DELIVERY' }
export type ReportSection = 'products' | 'inventory' | 'delivery' | 'customers'
export type ReportRow = Record<string, string | number | null>
export type ReportPage = { content: ReportRow[]; page: number; size: number; totalElements: number }
export type LiveReport = {
  from: string; to: string; timezone: string; generatedAt: string
  sales: Record<'ordersCreated' | 'ordersCancelled' | 'ordersDelivered' | 'goods' | 'discounts' | 'deliveryFees' | 'returnsValue' | 'revenue' | 'cashIn' | 'transferIn' | 'refunds' | 'netPayments' | 'undatedDeliveredOrders', number>
  days: { date: string; revenue: number; collected: number; orders: number }[]
  channels: { channel: keyof typeof channelLabels; orders: number; revenue: number }[]
  deposits: { collected: number; refunded: number; held: number; bottlesHeld: number }
  receipts: { count: number; value: number; damaged: number }
}
const params = (query: object) => {
  const result = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== '') result.set(key, String(value))
  return result.toString()
}
export const reportApi = {
  summary: (query: ReportQuery) => api.get<LiveReport>(`/admin/reports/summary?${params(query)}`),
  section: (section: ReportSection, query: ReportQuery, page = 0, size = 20) => api.get<ReportPage>(`/admin/reports/${section}?${params({ ...query, page, size })}`),
}
