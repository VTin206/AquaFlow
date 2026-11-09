import type { Order } from '@/features/orders/types'
import { channelLabels, type LiveReport, type ReportPage, type ReportQuery, type ReportRow, type ReportSection } from './reportApi'
import { reportService, type PeriodReport, type ReportFilters } from './reportService'

// Chuyển báo cáo tính từ dữ liệu mẫu sang đúng kiểu của API để dùng chung một trang báo cáo.

const channelCode = Object.fromEntries(Object.entries(channelLabels).map(([code, label]) => [label, code])) as Record<string, keyof typeof channelLabels>

const filtersOf = (query: ReportQuery): ReportFilters => ({
  channels: query.channel ? [channelLabels[query.channel] as Order['channel']] : [],
  method: query.method === 'DELIVERY' ? 'Giao tận nơi' : query.method === 'COUNTER' ? 'Tại quầy' : undefined,
})

const build = (query: ReportQuery) => reportService.summary({ from: query.from, to: query.to }, filtersOf(query))

const sectionRows = (report: PeriodReport, section: ReportSection): ReportRow[] => {
  if (section === 'products') {
    return report.products.map((row) => ({
      productId: row.productId,
      sku: row.sku,
      name: row.name,
      unit: row.unit,
      sold: row.sold,
      returned: row.returned,
      revenue: row.revenue,
    }))
  }
  if (section === 'inventory') {
    return report.inventory.rows.map((row) => ({
      productId: row.productId,
      name: row.name,
      unit: row.unit,
      opening: row.opening,
      received: row.received,
      restocked: row.restocked,
      issued: row.issued,
      adjustments: null,
      closing: row.closing,
      latestUnitCost: null,
      closingValue: row.closingValue,
      damaged: row.damaged,
      discarded: null,
    }))
  }
  if (section === 'delivery') {
    return report.delivery.drivers.map((row) => ({
      driverId: row.driver,
      driver: row.driver,
      delivered: row.delivered,
      failed: row.failed,
      redelivered: null,
      appointed: null,
      late: row.late,
      settledTrips: row.settledTrips,
      cashReported: row.cashExpected,
      cashConfirmed: row.cashHandedOver,
      cashDifference: row.cashExpected - row.cashHandedOver,
    }))
  }
  return report.customers.top.map((row) => ({ key: row.key, name: row.name, orders: row.orders, revenue: row.revenue }))
}

export const demoReportApi = {
  summary: async (query: ReportQuery): Promise<LiveReport> => {
    const report = await build(query)
    return {
      from: report.range.from,
      to: report.range.to,
      timezone: 'Asia/Ho_Chi_Minh',
      generatedAt: new Date().toISOString(),
      sales: {
        averageOrderValue: report.sales.averageOrder,
        newCustomers: report.customers.new,
        ordersCreated: report.sales.orders,
        ordersCancelled: report.sales.cancelled,
        ordersDelivered: report.sales.delivered,
        goods: report.sales.goods,
        discounts: 0,
        deliveryFees: report.sales.deliveryFees,
        returnsValue: report.sales.returnsValue,
        revenue: report.sales.net,
        cashIn: report.cash.cash,
        transferIn: report.cash.transfer,
        refunds: report.cash.refunds,
        netPayments: report.cash.collected,
        undatedDeliveredOrders: 0,
      },
      days: report.days,
      channels: report.channels.map((row) => ({ channel: channelCode[row.channel], orders: row.orders, revenue: row.revenue })),
      deposits: {
        collected: report.deposits.collected,
        refunded: report.deposits.refunded,
        held: report.deposits.held.deposit,
        bottlesHeld: report.deposits.held.bottles,
      },
      receipts: { count: report.receipts.count, value: report.receipts.value, damaged: 0 },
    }
  },
  section: async (section: ReportSection, query: ReportQuery, page = 0, size = 20): Promise<ReportPage> => {
    const rows = sectionRows(await build(query), section)
    return { content: rows.slice(page * size, (page + 1) * size), page, size, totalElements: rows.length }
  },
}
