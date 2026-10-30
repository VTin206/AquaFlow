import assert from 'node:assert/strict'
import console from 'node:console'
import { setTimeout } from 'node:timers'
import ExcelJS from 'exceljs'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
const sample = {
  range: { from: '2026-09-30', to: '2026-10-01' },
  days: [
    { date: '2026-09-30', revenue: 90000, collected: -20000, orders: 2 },
    { date: '2026-10-01', revenue: 0, collected: 0, orders: 0 },
  ],
  sales: { orders: 2, delivered: 1, cancelled: 1, goods: 100000, deliveryFees: 10000, returnsValue: 20000, net: 90000, averageOrder: 110000 },
  cash: { collected: -20000, cash: 0, transfer: 0, refunds: 20000 },
  deposits: {
    collected: 50000, refunded: 100000, bottlesOut: 1, bottlesBack: 2, bottlesLost: 0,
    held: { bottles: 3, deposit: 150000, customers: 2, uncoveredBottles: 1, top: [] },
  },
  delivery: {
    delivered: 1, failedAttempts: 2, withAppointment: 1, late: 1, averageLateMinutes: 15, cashShort: 5000, pendingTrips: 1,
    drivers: [{ driver: 'Nguyễn An', delivered: 1, failed: 2, late: 1, settledTrips: 1, cashExpected: 110000, cashHandedOver: 105000, cashShort: 5000, pendingTrips: 1, pendingCash: 40000 }],
  },
  customers: {
    active: 1, new: 1,
    top: [{ key: 'C-1', name: 'Chị Lan', phone: '0901000001', orders: 1, revenue: 90000 }],
    lapsed: [{ key: 'C-2', name: 'Anh Minh', phone: '0901000002', orders: 3, revenue: 0, daysSince: 42 }],
  },
  channels: [{ channel: 'Website', orders: 2, revenue: 90000 }],
  products: [{ productId: 'P-012', sku: '0012', name: '=1+1', unit: 'Bình', sold: 1, returned: 1, revenue: 100000, cost: 120000 }],
  inventory: {
    rows: [{ productId: 'P-012', name: 'Nước kiểm thử', unit: 'Bình', opening: 4, received: 3, restocked: 1, issued: 2, closing: 6, damaged: 1, closingValue: 120000 }],
    openingValue: 80000, closingValue: 120000,
  },
  receipts: { count: 1, value: 360000 },
  profit: { goodsRevenue: 100000, cost: 120000, gross: -20000 },
}
const sheetNames = ['Tổng quan', 'Theo ngày', 'Cọc và vỏ', 'Giao hàng', 'Bán hàng', 'Nhập xuất tồn', 'Khách hàng', 'Khách lâu chưa đặt', 'Kênh tiếp nhận']

try {
  const { buildReportWorkbook } = await server.ssrLoadModule('/src/features/reports/exportReport.ts')
  const before = globalThis.structuredClone(sample)
  const bytes = await buildReportWorkbook(sample, { channels: ['Website'], method: 'Giao tận nơi' }).xlsx.writeBuffer()
  assert.equal(bytes.slice(0, 2).toString(), 'PK', 'File must be an XLSX ZIP, not renamed text')
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(bytes)
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), sheetNames)
  for (const sheet of workbook.worksheets) {
    assert.match(sheet.getCell('A2').value, /30\/09\/2026 – 01\/10\/2026/)
    assert.match(sheet.getCell('A2').value, /Lọc: kênh Website · giao tận nơi/)
    assert.equal(sheet.views[0].ySplit, 4)
    assert.ok(sheet.autoFilter)
    assert.equal(sheet.getCell('A4').font.bold, true)
  }
  console.log('PASS serialized workbook has every report sheet, selected period, active filters and frozen headings')

  const summary = workbook.getWorksheet('Tổng quan')
  const valueOf = (sheet, label) => {
    let cell
    sheet.eachRow((row) => { if (row.getCell(1).value === label) cell = row.getCell(2) })
    assert.ok(cell, label)
    return cell
  }
  for (const [label, value] of [
    ['Tiền hàng (đơn đã giao)', 100000], ['Trừ hàng khách trả trong kỳ', -20000], ['Doanh thu thuần', 90000],
    ['Tiền thực thu (sau hoàn)', -20000], ['Lãi gộp ước tính', -20000], ['Phiếu nhập trong kỳ', 1], ['Đơn hủy', 1], ['Khách mới', 1],
  ]) {
    assert.equal(valueOf(summary, label).value, value)
    assert.equal(valueOf(summary, label).type, ExcelJS.ValueType.Number)
  }
  assert.match(valueOf(summary, 'Doanh thu thuần').numFmt, /₫/)
  const daily = workbook.getWorksheet('Theo ngày')
  assert.equal(daily.getCell('A5').value.toISOString(), '2026-09-30T00:00:00.000Z')
  assert.equal(daily.getCell('A5').numFmt, 'dd/mm/yyyy')
  assert.equal(daily.getCell('C5').value, -20000)
  assert.equal(daily.getCell('B6').value, 0)
  const bottles = workbook.getWorksheet('Cọc và vỏ')
  assert.equal(valueOf(bottles, 'Cọc vỏ đã hoàn').value, 100000)
  assert.equal(valueOf(bottles, 'Cọc đang giữ cuối kỳ').value, 150000)
  assert.match(valueOf(bottles, 'Cọc đang giữ cuối kỳ').numFmt, /₫/)
  assert.equal(valueOf(bottles, 'Vỏ chưa đủ cọc cuối kỳ').value, 1)
  const drivers = workbook.getWorksheet('Giao hàng')
  assert.equal(drivers.getCell('A5').value, 'Nguyễn An')
  assert.equal(drivers.getCell('H5').value, 5000)
  assert.equal(drivers.getCell('J5').value, 40000)
  assert.equal(workbook.getWorksheet('Kênh tiếp nhận').getCell('C5').value, 90000)
  assert.equal(workbook.getWorksheet('Khách lâu chưa đặt').getCell('C5').value, 42)
  console.log('PASS numeric amounts, negative values, zero, dates, settlement and Vietnamese survive XLSX round trip')

  const products = workbook.getWorksheet('Bán hàng')
  assert.equal(products.getCell('A5').value, '0012')
  assert.equal(products.getCell('A5').type, ExcelJS.ValueType.String)
  assert.equal(products.getCell('B5').value, '=1+1')
  assert.equal(products.getCell('B5').type, ExcelJS.ValueType.String)
  assert.equal(products.getCell('H5').value, -20000)
  const stock = workbook.getWorksheet('Nhập xuất tồn')
  assert.deepEqual([3, 4, 5, 6, 7, 8, 9].map((column) => stock.getCell(5, column).value), [4, 3, 1, 2, 6, 1, 120000])
  assert.deepEqual(sample, before, 'Export must not change report data')
  console.log('PASS product codes preserve leading zero; formula-like names stay text; profit and stock movement are correct')

  const empty = globalThis.structuredClone(sample)
  empty.days = []
  empty.products = []
  empty.channels = []
  empty.delivery.drivers = []
  empty.inventory.rows = []
  empty.customers.top = []
  empty.customers.lapsed = []
  const emptyWorkbook = new ExcelJS.Workbook()
  await emptyWorkbook.xlsx.load(await buildReportWorkbook(empty).xlsx.writeBuffer())
  for (const name of ['Theo ngày', 'Giao hàng', 'Bán hàng', 'Nhập xuất tồn', 'Khách hàng', 'Khách lâu chưa đặt', 'Kênh tiếp nhận']) {
    assert.equal(emptyWorkbook.getWorksheet(name).rowCount, 4)
    assert.ok(emptyWorkbook.getWorksheet(name).autoFilter)
  }
  assert.doesNotMatch(emptyWorkbook.getWorksheet('Tổng quan').getCell('A2').value, /Lọc:/)
  console.log('PASS empty detail sheets still produce a readable workbook with headings; no filter note without filters')

  // Đi qua service thật để phát hiện nhầm ID nội bộ với SKU trong dữ liệu xuất.
  globalThis.window = { setTimeout: (callback) => setTimeout(callback, 0) }
  const { db } = await server.ssrLoadModule('/src/mocks/db.ts')
  const { reportService } = await server.ssrLoadModule('/src/features/reports/reportService.ts')
  const deliveredAt = '2026-09-30T05:00:00.000Z'
  const line = (productId, name) => ({ productId, name, unit: 'Bình', quantity: 1, unitPrice: 20000 })
  db.orders = [{
    id: 'DH-T1', customer: 'Khách kiểm thử', phone: '0901000009', address: '', channel: 'Tại quầy', method: 'Tại quầy', status: 'Đã giao',
    deliveryFee: 0, deliveredAt, payments: [], returns: [],
    lines: [line('P-INTERNAL', 'Nước kiểm thử'), line('P-REMOVED', 'Sản phẩm cũ')],
    history: [{ at: deliveredAt, by: 'Kiểm thử', message: 'Tạo đơn' }],
  }]
  db.archivedOrders = []
  db.lots = []
  db.receipts = []
  db.bottleLedger = []
  db.trips = []
  db.products = [{ id: 'P-INTERNAL', sku: '0012', name: 'Nước kiểm thử', unit: 'Bình', price: 20000, stock: 2 }]
  const report = await reportService.summary(sample.range)
  assert.equal(report.products.find((row) => row.productId === 'P-INTERNAL').sku, '0012')
  assert.equal(report.products.find((row) => row.productId === 'P-REMOVED').sku, null)
  const serviceWorkbook = new ExcelJS.Workbook()
  await serviceWorkbook.xlsx.load(await buildReportWorkbook(report).xlsx.writeBuffer())
  const serviceProducts = serviceWorkbook.getWorksheet('Bán hàng')
  const codes = [5, 6].map((row) => serviceProducts.getCell(row, 1).value)
  assert.ok(codes.includes('0012'), 'Catalog SKU is exported')
  assert.ok(codes.some((value) => [null, ''].includes(value)), 'Unknown SKU stays blank instead of exporting an internal ID')
  assert.ok(!codes.includes('P-INTERNAL') && !codes.includes('P-REMOVED'))
  console.log('PASS report service exports catalog SKU, preserves leading zero and leaves missing SKU blank')
} finally {
  await server.close()
}
