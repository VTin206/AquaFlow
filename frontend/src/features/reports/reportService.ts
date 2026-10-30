import { useQuery } from '@tanstack/react-query'
import { db } from '../../mocks/db'
import { mockError, mockRequest } from '../../mocks/mockRequest'
import { createdAtOf, minutesLate, type Order } from '../orders/types'

// Đang tính từ dữ liệu mẫu. Khi backend có API báo cáo, thay bằng api.get('/reports/summary', { params: range }).

/** Khoảng ngày "yyyy-mm-dd", tính cả hai đầu, theo giờ địa phương. */
export type ReportRange = { from: string; to: string }

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
  received: number
  damaged: number
  stock: number
}

export type DriverReportRow = { driver: string; delivered: number; failed: number; late: number }

export type PeriodReport = {
  range: ReportRange
  days: DailyRevenue[]
  sales: { orders: number; delivered: number; cancelled: number; revenue: number; deliveryFees: number; returnsValue: number; averageOrder: number }
  cash: { collected: number; cash: number; transfer: number; refunds: number }
  deposits: { collected: number; refunded: number; bottlesOut: number; bottlesBack: number; bottlesLost: number }
  delivery: { delivered: number; failedAttempts: number; withAppointment: number; late: number; averageLateMinutes: number; drivers: DriverReportRow[] }
  channels: { channel: Order['channel']; orders: number; revenue: number }[]
  products: ProductReportRow[]
  receipts: { count: number; value: number }
  profit: { goodsRevenue: number; cost: number; gross: number }
}

/** "2026-10-16T03:00:00Z" → ngày địa phương "2026-10-16". */
export const localDay = (iso: string) => {
  const date = new Date(iso)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const daysBetween = ({ from, to }: ReportRange) => {
  const days: string[] = []
  for (let day = new Date(`${from}T00:00:00`); localDay(day.toISOString()) <= to; day.setDate(day.getDate() + 1)) days.push(localDay(day.toISOString()))
  return days
}

const allOrders = () => [...db.archivedOrders, ...db.orders]

/** Giá vốn bình quân theo các lô đã nhập; chưa có lô thì ước 70% giá bán. */
const unitCost = (productId: string) => {
  const lots = db.lots.filter((lot) => lot.productId === productId && lot.received > 0)
  const quantity = lots.reduce((sum, lot) => sum + lot.received, 0)
  if (quantity) return Math.round(lots.reduce((sum, lot) => sum + lot.received * lot.costPrice, 0) / quantity)
  return Math.round(((db.products.find((product) => product.id === productId)?.price ?? 0) * 0.7) / 1000) * 1000
}

function buildReport(range: ReportRange): PeriodReport {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(range.from) || !/^\d{4}-\d{2}-\d{2}$/.test(range.to) || range.from > range.to) throw mockError(400, 'Khoảng thời gian không hợp lệ.')
  const inRange = (iso?: string) => Boolean(iso) && localDay(iso!) >= range.from && localDay(iso!) <= range.to
  const orders = allOrders()
  const created = orders.filter((order) => inRange(createdAtOf(order)))
  // Doanh thu ghi nhận khi khách nhận hàng; đơn đã hủy không tính.
  const delivered = orders.filter((order) => order.status !== 'Đã hủy' && inRange(order.deliveredAt))
  const payments = orders.flatMap((order) => order.payments).filter((payment) => inRange(payment.recordedAt))
  const returns = orders.flatMap((order) => order.returns ?? []).filter((item) => inRange(item.at))

  const days = daysBetween(range).map((date) => ({
    date,
    revenue: delivered.filter((order) => localDay(order.deliveredAt!) === date).reduce((sum, order) => sum + order.total, 0),
    collected: payments.filter((payment) => localDay(payment.recordedAt) === date).reduce((sum, payment) => sum + (payment.refund ? -payment.amount : payment.amount), 0),
    orders: created.filter((order) => localDay(createdAtOf(order)!) === date).length,
  }))

  const revenue = delivered.reduce((sum, order) => sum + order.total, 0)
  const deliveryFees = delivered.reduce((sum, order) => sum + order.deliveryFee, 0)
  const sumOf = (method: string, refund: boolean) =>
    payments.filter((payment) => payment.method === method && Boolean(payment.refund) === refund).reduce((sum, payment) => sum + payment.amount, 0)
  const refunds = payments.filter((payment) => payment.refund).reduce((sum, payment) => sum + payment.amount, 0)

  const ledger = db.bottleLedger.filter((entry) => inRange(entry.at))
  const ledgerSum = (kind: string, field: 'bottles' | 'deposit') => ledger.filter((entry) => entry.kind === kind).reduce((sum, entry) => sum + Math.abs(entry[field]), 0)

  const handovers = orders.flatMap((order) => order.history.filter((event) => inRange(event.at) && /^Giao (thành công|thất bại)/.test(event.message)).map((event) => ({ order, event })))
  const homeDeliveries = delivered.filter((order) => order.method === 'Giao tận nơi')
  const lateMinutes = homeDeliveries.map((order) => minutesLate(order)).filter((minutes) => minutes > 0)
  const drivers = new Map<string, DriverReportRow>()
  for (const { order, event } of handovers) {
    const driver = event.by ?? 'Chưa rõ'
    const row = drivers.get(driver) ?? { driver, delivered: 0, failed: 0, late: 0 }
    if (event.message.startsWith('Giao thất bại')) row.failed++
    else {
      row.delivered++
      if (minutesLate(order) > 0) row.late++
    }
    drivers.set(driver, row)
  }

  const channels = (['Tại quầy', 'Điện thoại', 'Tin nhắn', 'Website'] as const).map((channel) => ({
    channel,
    orders: created.filter((order) => order.channel === channel).length,
    revenue: delivered.filter((order) => order.channel === channel).reduce((sum, order) => sum + order.total, 0),
  }))

  const receipts = db.receipts.filter((receipt) => receipt.receivedAt >= range.from && receipt.receivedAt <= range.to)
  const products = new Map<string, ProductReportRow>()
  const rowOf = (productId: string, name: string, unit: string) => {
    const existing = products.get(productId)
    if (existing) return existing
    const product = db.products.find((item) => item.id === productId)
    const row: ProductReportRow = { productId, sku: product?.sku ?? null, name, unit, sold: 0, returned: 0, revenue: 0, cost: 0, received: 0, damaged: 0, stock: product?.stock ?? 0 }
    products.set(productId, row)
    return row
  }
  for (const order of delivered)
    for (const line of order.lines) {
      const row = rowOf(line.productId, line.name, line.unit)
      row.sold += line.quantity
      row.revenue += line.quantity * line.unitPrice
    }
  for (const item of returns)
    for (const line of item.lines) {
      const row = rowOf(line.productId, line.name, line.unit)
      row.returned += line.quantity
      row.sold -= line.quantity
      row.revenue -= line.quantity * line.unitPrice
    }
  for (const receipt of receipts)
    for (const line of receipt.lines) {
      const row = rowOf(line.productId, line.productName, line.unit)
      row.received += line.received - line.damaged
      row.damaged += line.damaged
    }
  products.forEach((row) => {
    row.cost = row.sold * unitCost(row.productId)
  })
  const productRows = [...products.values()].sort((a, b) => b.revenue - a.revenue)
  const goodsRevenue = productRows.reduce((sum, row) => sum + row.revenue, 0)
  const cost = productRows.reduce((sum, row) => sum + row.cost, 0)
  const returnsValue = returns.flatMap((item) => item.lines).reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)

  return {
    range,
    days,
    sales: {
      orders: created.length,
      delivered: delivered.length,
      cancelled: created.filter((order) => order.status === 'Đã hủy').length,
      revenue,
      deliveryFees,
      returnsValue,
      averageOrder: delivered.length ? Math.round(revenue / delivered.length) : 0,
    },
    cash: { collected: payments.reduce((sum, payment) => sum + (payment.refund ? -payment.amount : payment.amount), 0), cash: sumOf('Tiền mặt', false), transfer: sumOf('Chuyển khoản', false), refunds },
    deposits: {
      collected: ledgerSum('Thu cọc', 'deposit'),
      refunded: ledgerSum('Hoàn cọc', 'deposit'),
      bottlesOut: ledgerSum('Giao kèm đơn', 'bottles'),
      bottlesBack: ledgerSum('Thu vỏ', 'bottles'),
      bottlesLost: ledgerSum('Báo mất/vỡ', 'bottles'),
    },
    delivery: {
      delivered: homeDeliveries.length,
      failedAttempts: handovers.filter(({ event }) => event.message.startsWith('Giao thất bại')).length,
      withAppointment: homeDeliveries.filter((order) => order.appointment).length,
      late: lateMinutes.length,
      averageLateMinutes: lateMinutes.length ? Math.round(lateMinutes.reduce((sum, minutes) => sum + minutes, 0) / lateMinutes.length) : 0,
      drivers: [...drivers.values()].sort((a, b) => b.delivered - a.delivered),
    },
    channels,
    products: productRows,
    receipts: { count: receipts.length, value: receipts.reduce((sum, receipt) => sum + receipt.total, 0) },
    profit: { goodsRevenue, cost, gross: goodsRevenue - cost },
  }
}

export const reportService = {
  summary: (range: ReportRange) => mockRequest(() => buildReport(range)),
}

export const reportKeys = { all: ['reports'] as const, summary: (range: ReportRange) => ['reports', 'summary', range.from, range.to] as const }

/** Ngày "yyyy-mm-dd" cách hôm nay `offset` ngày. */
export const dayFromToday = (offset = 0) => {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return localDay(date.toISOString())
}

export const useReport = (range: ReportRange) => useQuery({ queryKey: reportKeys.summary(range), queryFn: () => reportService.summary(range) })

/** Doanh thu 14 ngày gần nhất cho trang tổng quan. */
export function useDailyRevenue() {
  const query = useReport({ from: dayFromToday(-13), to: dayFromToday() })
  return { ...query, data: query.data?.days }
}
