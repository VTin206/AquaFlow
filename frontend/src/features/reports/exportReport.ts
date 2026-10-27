import ExcelJS from 'exceljs'
import type { PeriodReport } from './reportService'

const moneyFormat = '#,##0 "₫";[Red]-#,##0 "₫"'
type Cell = string | number | Date
type Column = { title: string; width: number; format?: string }
const money = (title: string): Column => ({ title, width: 23, format: moneyFormat })
const count = (title: string): Column => ({ title, width: 17, format: '#,##0' })
const vnDate = (iso: string) => iso.split('-').reverse().join('/')

/** Dữ liệu số/ngày giữ nguyên kiểu để người dùng lọc và tính tiếp trong Excel. */
export function buildReportWorkbook(report: PeriodReport) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'AquaFlow'
  workbook.created = new Date()
  const { range, sales, cash, deposits, delivery, receipts, profit } = report

  const sheet = (name: string, columns: Column[], rows: Cell[][], note = '') => {
    const worksheet = workbook.addWorksheet(name, {
      views: [{ state: 'frozen', ySplit: 4 }],
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:4' },
    })
    worksheet.columns = columns.map((column) => ({ width: column.width, style: { numFmt: column.format ?? '@' } }))
    for (let row = 1; row <= 3; row++) worksheet.mergeCells(row, 1, row, columns.length)
    worksheet.getCell('A1').value = `AquaFlow — ${name}`
    worksheet.getCell('A1').font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FF087FAD' } }
    worksheet.getRow(1).height = 30
    worksheet.getCell('A2').value = `Kỳ báo cáo: ${vnDate(range.from)} – ${vnDate(range.to)} (gồm cả hai ngày)`
    worksheet.getCell('A3').value = note
    worksheet.getCell('A3').alignment = { wrapText: true, vertical: 'middle' }
    worksheet.getRow(3).height = 32
    const header = worksheet.getRow(4)
    header.values = columns.map((column) => column.title)
    header.height = 32
    header.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF087FAD' } }
      cell.alignment = { vertical: 'middle', wrapText: true }
    })
    rows.forEach((values, index) => {
      const row = worksheet.addRow(values)
      row.eachCell((cell) => {
        cell.font = { name: 'Calibri', size: 11, color: { argb: 'FF263E53' } }
        cell.alignment = { vertical: 'top', wrapText: true }
        if (index % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F7FB' } }
      })
    })
    worksheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: Math.max(4, worksheet.rowCount), column: columns.length } }
    return worksheet
  }

  const summaryRows: [string, number, string][] = [
    ['Doanh thu (đơn đã giao)', sales.revenue, '₫'],
    ['Trong đó phí giao', sales.deliveryFees, '₫'],
    ['Hàng khách trả lại', sales.returnsValue, '₫'],
    ['Doanh thu bình quân / đơn đã giao', sales.averageOrder, '₫'],
    ['Đơn tạo trong kỳ', sales.orders, 'đơn'],
    ['Đơn đã giao', sales.delivered, 'đơn'],
    ['Đơn hủy', sales.cancelled, 'đơn'],
    ['Tiền thực thu (sau hoàn)', cash.collected, '₫'],
    ['Thu tiền mặt (trước hoàn)', cash.cash, '₫'],
    ['Thu chuyển khoản (trước hoàn)', cash.transfer, '₫'],
    ['Hoàn tiền cho khách', cash.refunds, '₫'],
    ['Doanh thu hàng hóa (sau trả hàng)', profit.goodsRevenue, '₫'],
    ['Giá vốn ước tính', profit.cost, '₫'],
    ['Lãi gộp ước tính', profit.gross, '₫'],
    ['Phiếu nhập trong kỳ', receipts.count, 'phiếu'],
    ['Giá trị nhập trong kỳ', receipts.value, '₫'],
    ['Giao tận nơi thành công', delivery.delivered, 'đơn'],
    ['Lần giao thất bại', delivery.failedAttempts, 'lần'],
    ['Đơn giao có hẹn', delivery.withAppointment, 'đơn'],
    ['Đơn giao trễ hẹn', delivery.late, 'đơn'],
    ['Thời gian trễ trung bình', delivery.averageLateMinutes, 'phút'],
  ]
  const summary = sheet('Tổng quan', [{ title: 'Chỉ tiêu', width: 48 }, count('Giá trị'), { title: 'Đơn vị', width: 12 }], summaryRows,
    'Tiền cọc vỏ ghi riêng, không tính vào doanh thu. Giá vốn và lãi gộp là số ước tính.')
  summary.getColumn(2).width = 25
  summaryRows.forEach((row, index) => { if (row[2] === '₫') summary.getCell(index + 5, 2).numFmt = moneyFormat })

  sheet('Theo ngày', [{ title: 'Ngày', width: 16, format: 'dd/mm/yyyy' }, money('Doanh thu'), money('Tiền thực thu'), count('Đơn tạo')],
    report.days.map((day) => [new Date(`${day.date}T00:00:00Z`), day.revenue, day.collected, day.orders]),
    'Doanh thu ghi nhận theo ngày giao; tiền thực thu theo ngày thanh toán, đã trừ hoàn tiền.')

  const bottleRows: [string, number, string][] = [
    ['Cọc vỏ đã thu', deposits.collected, '₫'], ['Cọc vỏ đã hoàn', deposits.refunded, '₫'],
    ['Vỏ giao kèm đơn', deposits.bottlesOut, 'vỏ'], ['Vỏ đã thu lại', deposits.bottlesBack, 'vỏ'], ['Vỏ mất / vỡ', deposits.bottlesLost, 'vỏ'],
  ]
  const bottles = sheet('Cọc và vỏ', [{ title: 'Chỉ tiêu', width: 38 }, count('Giá trị'), { title: 'Đơn vị', width: 12 }], bottleRows,
    'Biến động trong kỳ, không phải số dư cọc hoặc số vỏ khách đang giữ.')
  bottles.getColumn(2).width = 25
  bottles.getCell('B5').numFmt = moneyFormat
  bottles.getCell('B6').numFmt = moneyFormat

  sheet('Giao hàng', [{ title: 'Tài xế', width: 30 }, count('Thành công'), count('Thất bại'), count('Trễ hẹn')],
    delivery.drivers.map((row) => [row.driver, row.delivered, row.failed, row.late]))
  sheet('Nhập xuất tồn', [
    { title: 'Mã sản phẩm', width: 20 }, { title: 'Sản phẩm', width: 42 }, { title: 'Đơn vị', width: 12 },
    count('Nhập đạt'), count('Nhập hỏng'), count('Đã bán (trừ trả)'), count('Trả lại'), count('Tồn hiện tại'),
    money('Doanh thu'), money('Giá vốn ước tính'), money('Lãi gộp ước tính'),
  ], report.products.map((row) => [row.sku ?? '', row.name, row.unit, row.received, row.damaged, row.sold, row.returned, row.stock, row.revenue, row.cost, row.revenue - row.cost]),
  'Tồn hiện tại là số tồn lúc xuất báo cáo, không phải tồn cuối kỳ. Nhập / bán / trả tính trong kỳ; giá vốn ước tính theo lô.')
  sheet('Kênh tiếp nhận', [{ title: 'Kênh', width: 26 }, count('Đơn tạo'), money('Doanh thu')],
    report.channels.map((row) => [row.channel, row.orders, row.revenue]))
  return workbook
}

export async function downloadReportExcel(report: PeriodReport) {
  const buffer = await buildReportWorkbook(report).xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([new Uint8Array(buffer).buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }))
  const link = document.createElement('a')
  link.href = url
  link.download = `bao-cao-${report.range.from}_${report.range.to}.xlsx`
  document.body.appendChild(link)
  try {
    link.click()
  } finally {
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
