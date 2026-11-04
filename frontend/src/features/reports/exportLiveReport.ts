import ExcelJS from 'exceljs'
import { saveWorkbook } from '@/shared/utils/excel'
import { channelLabels, type LiveReport, type ReportQuery, type ReportRow } from './reportApi'

export type ReportColumn = { key: string; title: string; money?: boolean }
export function buildLiveReportWorkbook(report: LiveReport, query: ReportQuery, title: string, columns: ReportColumn[], rows: ReportRow[], page?: number) {
  const book = new ExcelJS.Workbook()
  book.creator = 'AquaFlow'
  const sheet = book.addWorksheet('Báo cáo')
  sheet.addRow([title])
  sheet.addRow([`${query.from} – ${query.to} · Giờ Việt Nam · ${query.channel ? channelLabels[query.channel] : 'Mọi kênh'} · ${query.method ?? 'Mọi hình thức'}`])
  sheet.addRow([page === undefined ? 'Toàn bộ ngày trong kỳ' : `Trang ${page + 1}, chỉ xuất các dòng đang hiển thị`])
  sheet.addRow([`Dữ liệu lấy lúc ${report.generatedAt}. Tồn kho, nhập hàng, sổ cọc và đối soát tính cho cả cửa hàng.`])
  sheet.addRow(columns.map(column => column.title))
  sheet.getRow(5).font = { bold: true }
  for (const row of rows) sheet.addRow(columns.map(column => row[column.key] ?? ''))
  sheet.columns.forEach((column, i) => { column.width = 24; if (columns[i]?.money) column.numFmt = '#,##0.00' })
  sheet.views = [{ state: 'frozen', ySplit: 5 }]
  return book
}

export async function downloadLiveReport(report: LiveReport, query: ReportQuery, title: string, columns: ReportColumn[], rows: ReportRow[], page?: number) {
  await saveWorkbook(buildLiveReportWorkbook(report, query, title, columns, rows, page), `bao-cao-${query.from}-${query.to}.xlsx`)
}
