import { useQuery } from '@tanstack/react-query'
import type { Order } from '@/features/orders/types'
import { reportApi } from './reportApi'

// Kiểu số liệu báo cáo và các hàm ngày dùng chung; số liệu lấy từ API báo cáo (reportApi).

/** Khoảng ngày "yyyy-mm-dd", tính cả hai đầu, theo giờ địa phương. */
export type ReportRange = { from: string; to: string }

/** Lọc các số liệu theo đơn. Tồn kho, vỏ cọc và nhập hàng luôn tính cho cả cửa hàng. */
export type ReportFilters = { channels?: Order['channel'][]; method?: Order['method'] }

export const reportChannels: Order['channel'][] = ['Tại quầy', 'Điện thoại', 'Tin nhắn', 'Website']

/** `revenue` là doanh thu thuần trong ngày: tiền hàng + phí giao của đơn giao trong ngày, trừ hàng khách trả trong ngày. */
export type DailyRevenue = { date: string; revenue: number; collected: number; orders: number }

export type ProductReportRow = {
  productId: string
  sku: string | null
  name: string
  unit: string
  /** Đã giao trong kỳ, trừ hàng khách trả. */
  sold: number
  returned: number
  revenue: number
  /** Giá vốn ước tính theo giá nhập bình quân của các lô. */
  cost: number
}

/** Nhập – xuất – tồn theo số lượng thực có trong kho (gồm hàng đang giữ cho đơn chưa giao). */
export type InventoryReportRow = {
  productId: string
  name: string
  unit: string
  opening: number
  /** Hàng đạt nhập từ nhà cung cấp. */
  received: number
  /** Hàng khách trả còn tốt, nhập lại kho. */
  restocked: number
  /** Xuất giao cho khách. */
  issued: number
  closing: number
  /** Hỏng khi kiểm nhận, không vào kho. */
  damaged: number
  closingValue: number
}

export type BottleHolderRow = { customerId: string; name: string; bottles: number; deposit: number }

export type DriverReportRow = {
  driver: string
  delivered: number
  failed: number
  late: number
  /** Chuyến đã đối soát trong kỳ (theo ngày đối soát). */
  settledTrips: number
  cashExpected: number
  cashHandedOver: number
  /** Dương: tài xế nộp thiếu; âm: nộp dư. */
  cashShort: number
  /** Chuyến đã về nhưng chưa đối soát, tính tới hiện tại. */
  pendingTrips: number
  pendingCash: number
}

export type CustomerReportRow = {
  key: string
  name: string
  phone: string
  orders: number
  revenue: number
  lastOrder?: string
  daysSince?: number
}

export type PeriodReport = {
  range: ReportRange
  days: DailyRevenue[]
  sales: {
    orders: number
    delivered: number
    cancelled: number
    /** Tiền hàng của đơn giao trong kỳ, theo giá đã chốt (chưa trừ hàng trả). */
    goods: number
    deliveryFees: number
    /** Hàng khách trả trong kỳ, tính theo ngày trả chứ không theo ngày giao. */
    returnsValue: number
    /** Doanh thu thuần = tiền hàng + phí giao − hàng trả. */
    net: number
    averageOrder: number
  }
  cash: { collected: number; cash: number; transfer: number; refunds: number }
  deposits: {
    collected: number
    refunded: number
    bottlesOut: number
    bottlesBack: number
    bottlesLost: number
    /** Số dư tới hết ngày cuối kỳ, cộng dồn từ sổ vỏ. */
    held: {
      bottles: number
      deposit: number
      customers: number
      /** Vỏ khách giữ mà tiền cọc chưa đủ, quy ra số vỏ. */
      uncoveredBottles: number
      top: BottleHolderRow[]
    }
  }
  delivery: {
    delivered: number
    failedAttempts: number
    withAppointment: number
    late: number
    averageLateMinutes: number
    drivers: DriverReportRow[]
    cashShort: number
    pendingTrips: number
  }
  customers: {
    /** Khách có đơn giao trong kỳ. */
    active: number
    /** Đơn đầu tiên rơi vào kỳ và không có đơn trước khi dùng hệ thống. */
    new: number
    top: CustomerReportRow[]
    /** Đã mua từ 2 lần, không có đơn trong 30 ngày tính tới cuối kỳ. */
    lapsed: CustomerReportRow[]
  }
  channels: { channel: Order['channel']; orders: number; revenue: number }[]
  products: ProductReportRow[]
  inventory: { rows: InventoryReportRow[]; openingValue: number; closingValue: number }
  receipts: { count: number; value: number }
  profit: { goodsRevenue: number; cost: number; gross: number }
}

/** "2026-10-16T03:00:00Z" → ngày địa phương "2026-10-16". */
export const localDay = (iso: string) => {
  const date = new Date(iso)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Kỳ liền trước, cùng số ngày. */
export function previousRange({ from, to }: ReportRange): ReportRange {
  const start = new Date(`${from}T00:00:00`)
  const length = Math.round((new Date(`${to}T00:00:00`).getTime() - start.getTime()) / 86_400_000) + 1
  const end = new Date(start)
  end.setDate(end.getDate() - 1)
  const begin = new Date(end)
  begin.setDate(begin.getDate() - length + 1)
  return { from: localDay(begin.toISOString()), to: localDay(end.toISOString()) }
}

/** Ngày "yyyy-mm-dd" cách hôm nay `offset` ngày. */
export const dayFromToday = (offset = 0) => {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return localDay(date.toISOString())
}

/** Doanh thu 14 ngày gần nhất cho trang tổng quan; ngày cuối danh sách là hôm nay. */
export function useDailyRevenue(enabled = true) {
  const range = { from: dayFromToday(-13), to: dayFromToday() }
  const query = useQuery({
    queryKey: ['live', 'reports', 'summary', range],
    queryFn: () => reportApi.summary(range),
    enabled,
  })
  return {
    ...query,
    data: query.data?.days.map((day) => ({
      ...day,
      revenue: Number(day.revenue),
      collected: Number(day.collected),
    })),
  }
}
