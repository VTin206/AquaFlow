import assert from 'node:assert/strict'
import console from 'node:console'
import ExcelJS from 'exceljs'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
const sample = {
  range: { from: '2026-09-30', to: '2026-10-01' },
  days: [
    { date: '2026-09-30', revenue: 110000, collected: -20000, orders: 2 },
    { date: '2026-10-01', revenue: 0, collected: 0, orders: 0 },
  ],
  sales: { orders: 2, delivered: 1, cancelled: 1, revenue: 110000, deliveryFees: 10000, returnsValue: 20000, averageOrder: 110000 },
  cash: { collected: -20000, cash: 0, transfer: 0, refunds: 20000 },
  deposits: { collected: 50000, refunded: 100000, bottlesOut: 1, bottlesBack: 2, bottlesLost: 0 },
  delivery: { delivered: 1, failedAttempts: 2, withAppointment: 1, late: 1, averageLateMinutes: 15, drivers: [{ driver: 'Nguyễn An', delivered: 1, failed: 2, late: 1 }] },
  channels: [{ channel: 'Website', orders: 2, revenue: 110000 }],
  products: [{ productId: '0012', name: '=1+1', unit: 'Bình', sold: 1, returned: 1, revenue: 100000, cost: 120000, received: 3, damaged: 1, stock: 5 }],
  receipts: { count: 1, value: 360000 },
  profit: { goodsRevenue: 100000, cost: 120000, gross: -20000 },
}

try {
  const { buildReportWorkbook } = await server.ssrLoadModule('/src/features/reports/exportReport.ts')
  const before = globalThis.structuredClone(sample)
  const bytes = await buildReportWorkbook(sample).xlsx.writeBuffer()
  assert.equal(bytes.slice(0, 2).toString(), 'PK', 'File must be an XLSX ZIP, not renamed text')
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(bytes)
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ['Tổng quan', 'Theo ngày', 'Cọc và vỏ', 'Giao hàng', 'Nhập xuất tồn', 'Kênh tiếp nhận'])
  for (const sheet of workbook.worksheets) {
    assert.match(sheet.getCell('A2').value, /30\/09\/2026 – 01\/10\/2026/)
    assert.equal(sheet.views[0].ySplit, 4)
    assert.ok(sheet.autoFilter)
    assert.equal(sheet.getCell('A4').font.bold, true)
  }
  console.log('PASS serialized workbook has six sheets, selected period, filters and frozen headings')

  const summary = workbook.getWorksheet('Tổng quan')
  const valueOf = (label) => {
    let cell
    summary.eachRow((row) => { if (row.getCell(1).value === label) cell = row.getCell(2) })
    assert.ok(cell, label)
    return cell
  }
  for (const [label, value] of [
    ['Doanh thu (đơn đã giao)', 110000], ['Tiền thực thu (sau hoàn)', -20000],
    ['Lãi gộp ước tính', -20000], ['Phiếu nhập trong kỳ', 1], ['Đơn hủy', 1],
  ]) {
    assert.equal(valueOf(label).value, value)
    assert.equal(valueOf(label).type, ExcelJS.ValueType.Number)
  }
  assert.match(valueOf('Tiền thực thu (sau hoàn)').numFmt, /₫/)
  const daily = workbook.getWorksheet('Theo ngày')
  assert.equal(daily.getCell('A5').value.toISOString(), '2026-09-30T00:00:00.000Z')
  assert.equal(daily.getCell('A5').numFmt, 'dd/mm/yyyy')
  assert.equal(daily.getCell('C5').value, -20000)
  assert.equal(daily.getCell('B6').value, 0)
  assert.equal(workbook.getWorksheet('Cọc và vỏ').getCell('B6').value, 100000)
  assert.equal(workbook.getWorksheet('Giao hàng').getCell('A5').value, 'Nguyễn An')
  assert.equal(workbook.getWorksheet('Kênh tiếp nhận').getCell('C5').value, 110000)
  console.log('PASS numeric amounts, negative values, zero, dates and Vietnamese survive XLSX round trip')

  const products = workbook.getWorksheet('Nhập xuất tồn')
  assert.equal(products.getCell('A5').value, '0012')
  assert.equal(products.getCell('A5').type, ExcelJS.ValueType.String)
  assert.equal(products.getCell('B5').value, '=1+1')
  assert.equal(products.getCell('B5').type, ExcelJS.ValueType.String)
  assert.equal(products.getCell('E5').value, 1)
  assert.equal(products.getCell('H5').value, 5)
  assert.equal(products.getCell('K5').value, -20000)
  assert.match(products.getCell('A3').value, /không phải tồn cuối kỳ/)
  assert.deepEqual(sample, before, 'Export must not change report data')
  console.log('PASS product codes preserve leading zero; formula-like names stay text; signed profit and stock are correct')

  const empty = globalThis.structuredClone(sample)
  empty.days = []
  empty.products = []
  empty.channels = []
  empty.delivery.drivers = []
  const emptyWorkbook = new ExcelJS.Workbook()
  await emptyWorkbook.xlsx.load(await buildReportWorkbook(empty).xlsx.writeBuffer())
  for (const name of ['Theo ngày', 'Giao hàng', 'Nhập xuất tồn', 'Kênh tiếp nhận']) {
    assert.equal(emptyWorkbook.getWorksheet(name).rowCount, 4)
    assert.ok(emptyWorkbook.getWorksheet(name).autoFilter)
  }
  console.log('PASS empty detail sheets still produce a readable workbook with headings')
} finally {
  await server.close()
}
