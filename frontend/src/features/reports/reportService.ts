import { useQuery } from '@tanstack/react-query'
import { db } from '../../mocks/db'
import { DEPOSIT_PER_BOTTLE } from '../../shared/policy'
import { mockError, mockRequest } from '../../mocks/mockRequest'
import { createdAtOf, minutesLate, type Order, type OrderLine } from '../orders/types'

// Đang tính từ dữ liệu mẫu. Khi backend có API báo cáo, thay bằng api.get('/reports/summary', { params: range }).

/** Khoảng ngày "yyyy-mm-dd", tính cả hai đầu, theo giờ địa phương. */
export type ReportRange = { from: string; to: string }

/** `revenue` là doanh thu thuần trong ngày: tiền hàng + phí giao của đơn giao trong ngày, trừ hàng khách trả trong ngày. */
export type DailyRevenue = { date: string; revenue: number; collected: number; orders: number }

export type ProductReportRow = {
  productId: string
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

export type DriverReportRow = { driver: string; delivered: number; failed: number; late: number }

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
  delivery: { delivered: number; failedAttempts: number; withAppointment: number; late: number; averageLateMinutes: number; drivers: DriverReportRow[] }
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

const daysBetween = ({ from, to }: ReportRange) => {
  const days: string[] = []
  for (let day = new Date(`${from}T00:00:00`); localDay(day.toISOString()) <= to; day.setDate(day.getDate() + 1)) days.push(localDay(day.toISOString()))
  return days
}

const allOrders = () => [...db.archivedOrders, ...db.orders]

const valueOf = (lines: OrderLine[]) => lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)
/** Tiền hàng + phí giao theo các dòng đã chốt. Không dùng `order.total` vì trả hàng sau này làm giảm nó. */
const grossOf = (order: Order) => valueOf(order.lines) + order.deliveryFee

/** Giá vốn bình quân theo các lô đã nhập; chưa có lô thì ước 70% giá bán. */
const unitCost = (productId: string) => {
  const lots = db.lots.filter((lot) => lot.productId === productId && lot.received > 0)
  const quantity = lots.reduce((sum, lot) => sum + lot.received, 0)
  if (quantity) return Math.round(lots.reduce((sum, lot) => sum + lot.received * lot.costPrice, 0) / quantity)
  return Math.round(((db.products.find((product) => product.id === productId)?.price ?? 0) * 0.7) / 1000) * 1000
}

type StockMove = { productId: string; day: string; received?: number; restocked?: number; issued?: number }

/**
 * Chưa có sổ kho nên tính lùi từ tồn thực có hôm nay: tồn cuối = tồn hôm nay − (nhập − xuất) sau kỳ,
 * tồn đầu = tồn cuối − (nhập − xuất) trong kỳ. Backend thật nên lưu sổ kho và trả thẳng các số này.
 */
function buildInventory(range: ReportRange, orders: Order[]): PeriodReport['inventory'] {
  const moves: StockMove[] = [
    ...db.receipts.flatMap((receipt) => receipt.lines.map((line) => ({ productId: line.productId, day: receipt.receivedAt, received: line.received - line.damaged }))),
    ...orders
      .filter((order) => order.status !== 'Đã hủy' && order.deliveredAt)
      .flatMap((order) => order.lines.map((line) => ({ productId: line.productId, day: localDay(order.deliveredAt!), issued: line.quantity }))),
    ...orders
      .flatMap((order) => order.returns ?? [])
      .filter((item) => item.restocked)
      .flatMap((item) => item.lines.map((line) => ({ productId: line.productId, day: localDay(item.at), restocked: line.quantity }))),
  ]
  // Hàng đã trừ khỏi tồn bán được nhưng vẫn còn trong kho vì đơn chưa giao.
  const reserved = new Map<string, number>()
  for (const order of orders.filter((item) => item.stockReserved && !item.deliveredAt))
    for (const line of order.lines) reserved.set(line.productId, (reserved.get(line.productId) ?? 0) + line.quantity)
  const net = (move: StockMove) => (move.received ?? 0) + (move.restocked ?? 0) - (move.issued ?? 0)

  const rows = db.products.map((product): InventoryReportRow => {
    const own = moves.filter((move) => move.productId === product.id)
    const during = own.filter((move) => move.day >= range.from && move.day <= range.to)
    const sum = (field: 'received' | 'restocked' | 'issued') => during.reduce((total, move) => total + (move[field] ?? 0), 0)
    const onHand = product.stock + (reserved.get(product.id) ?? 0)
    const closing = onHand - own.filter((move) => move.day > range.to).reduce((total, move) => total + net(move), 0)
    const damaged = db.receipts
      .filter((receipt) => receipt.receivedAt >= range.from && receipt.receivedAt <= range.to)
      .flatMap((receipt) => receipt.lines)
      .filter((line) => line.productId === product.id)
      .reduce((total, line) => total + line.damaged, 0)
    return {
      productId: product.id,
      name: product.name,
      unit: product.unit,
      opening: closing - during.reduce((total, move) => total + net(move), 0),
      received: sum('received'),
      restocked: sum('restocked'),
      issued: sum('issued'),
      closing,
      damaged,
      closingValue: closing * unitCost(product.id),
    }
  })
  const active = rows.filter((row) => row.opening || row.received || row.restocked || row.issued || row.closing || row.damaged)
  return {
    rows: active.sort((a, b) => b.issued - a.issued || a.name.localeCompare(b.name, 'vi')),
    openingValue: active.reduce((total, row) => total + row.opening * unitCost(row.productId), 0),
    closingValue: active.reduce((total, row) => total + row.closingValue, 0),
  }
}

function buildReport(range: ReportRange): PeriodReport {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(range.from) || !/^\d{4}-\d{2}-\d{2}$/.test(range.to) || range.from > range.to) throw mockError(400, 'Khoảng thời gian không hợp lệ.')
  const inRange = (iso?: string) => Boolean(iso) && localDay(iso!) >= range.from && localDay(iso!) <= range.to
  const orders = allOrders()
  const created = orders.filter((order) => inRange(createdAtOf(order)))
  // Doanh thu ghi nhận khi khách nhận hàng; đơn đã hủy không tính. Hàng trả trừ vào kỳ khách trả.
  const delivered = orders.filter((order) => order.status !== 'Đã hủy' && inRange(order.deliveredAt))
  const payments = orders.flatMap((order) => order.payments).filter((payment) => inRange(payment.recordedAt))
  const returnsOf = (list: Order[]) => list.flatMap((order) => order.returns ?? []).filter((item) => inRange(item.at))
  const returns = returnsOf(orders)

  const days = daysBetween(range).map((date) => ({
    date,
    revenue:
      delivered.filter((order) => localDay(order.deliveredAt!) === date).reduce((sum, order) => sum + grossOf(order), 0) -
      returns.filter((item) => localDay(item.at) === date).reduce((sum, item) => sum + valueOf(item.lines), 0),
    collected: payments.filter((payment) => localDay(payment.recordedAt) === date).reduce((sum, payment) => sum + (payment.refund ? -payment.amount : payment.amount), 0),
    orders: created.filter((order) => localDay(createdAtOf(order)!) === date).length,
  }))

  const goods = delivered.reduce((sum, order) => sum + valueOf(order.lines), 0)
  const deliveryFees = delivered.reduce((sum, order) => sum + order.deliveryFee, 0)
  const returnsValue = returns.reduce((sum, item) => sum + valueOf(item.lines), 0)
  const sumOf = (method: string, refund: boolean) =>
    payments.filter((payment) => payment.method === method && Boolean(payment.refund) === refund).reduce((sum, payment) => sum + payment.amount, 0)
  const refunds = payments.filter((payment) => payment.refund).reduce((sum, payment) => sum + payment.amount, 0)

  const ledger = db.bottleLedger.filter((entry) => inRange(entry.at))
  const balances = new Map<string, BottleHolderRow>()
  for (const entry of db.bottleLedger.filter((item) => localDay(item.at) <= range.to)) {
    const row = balances.get(entry.customerId) ?? { customerId: entry.customerId, name: db.customers.find((customer) => customer.id === entry.customerId)?.name ?? entry.customerId, bottles: 0, deposit: 0 }
    row.bottles += entry.bottles
    row.deposit += entry.deposit
    balances.set(entry.customerId, row)
  }
  const holders = [...balances.values()].filter((row) => row.bottles > 0 || row.deposit > 0)
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
    revenue:
      delivered.filter((order) => order.channel === channel).reduce((sum, order) => sum + grossOf(order), 0) -
      returnsOf(orders.filter((order) => order.channel === channel)).reduce((sum, item) => sum + valueOf(item.lines), 0),
  }))

  const receipts = db.receipts.filter((receipt) => receipt.receivedAt >= range.from && receipt.receivedAt <= range.to)
  const products = new Map<string, ProductReportRow>()
  const rowOf = (productId: string, name: string, unit: string) => {
    const existing = products.get(productId)
    if (existing) return existing
    const row: ProductReportRow = { productId, name, unit, sold: 0, returned: 0, revenue: 0, cost: 0 }
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
  products.forEach((row) => {
    row.cost = row.sold * unitCost(row.productId)
  })
  const productRows = [...products.values()].sort((a, b) => b.revenue - a.revenue)
  const goodsRevenue = productRows.reduce((sum, row) => sum + row.revenue, 0)
  const cost = productRows.reduce((sum, row) => sum + row.cost, 0)

  const inventory = buildInventory(range, orders)

  return {
    range,
    days,
    sales: {
      orders: created.length,
      delivered: delivered.length,
      cancelled: created.filter((order) => order.status === 'Đã hủy').length,
      goods,
      deliveryFees,
      returnsValue,
      net: goods + deliveryFees - returnsValue,
      averageOrder: delivered.length ? Math.round((goods + deliveryFees) / delivered.length) : 0,
    },
    cash: { collected: payments.reduce((sum, payment) => sum + (payment.refund ? -payment.amount : payment.amount), 0), cash: sumOf('Tiền mặt', false), transfer: sumOf('Chuyển khoản', false), refunds },
    deposits: {
      collected: ledgerSum('Thu cọc', 'deposit'),
      refunded: ledgerSum('Hoàn cọc', 'deposit'),
      bottlesOut: ledgerSum('Giao kèm đơn', 'bottles'),
      bottlesBack: ledgerSum('Thu vỏ', 'bottles'),
      bottlesLost: ledgerSum('Báo mất/vỡ', 'bottles'),
      held: {
        bottles: holders.reduce((sum, row) => sum + Math.max(0, row.bottles), 0),
        deposit: holders.reduce((sum, row) => sum + row.deposit, 0),
        customers: holders.filter((row) => row.bottles > 0).length,
        uncoveredBottles: holders.reduce((sum, row) => sum + Math.max(0, row.bottles - Math.floor(row.deposit / DEPOSIT_PER_BOTTLE)), 0),
        top: [...holders].sort((a, b) => b.bottles - a.bottles).slice(0, 5),
      },
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
    inventory,
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
