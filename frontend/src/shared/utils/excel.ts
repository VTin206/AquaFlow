import type { Workbook } from 'exceljs'

export type ExcelColumn<T> = {
  title: string
  width?: number
  /** `money`: số có dấu phân cách hàng nghìn; chuỗi (mã, số điện thoại) giữ nguyên dạng chữ nên không mất số 0 đầu. */
  format?: 'money' | 'count'
  value: (row: T) => string | number | null | undefined
}

const formats = { money: '#,##0 "₫";[Red]-#,##0 "₫"', count: '#,##0' }

/** Lưu workbook thành tệp .xlsx qua trình duyệt. */
export async function saveWorkbook(workbook: Workbook, fileName: string) {
  const buffer = await workbook.xlsx.writeBuffer()
  const url = URL.createObjectURL(
    new Blob([new Uint8Array(buffer).buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  try {
    link.click()
  } finally {
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

/** Xuất một bảng thành tệp Excel một trang: dòng tiêu đề in đậm, cố định và có bộ lọc. ExcelJS chỉ tải khi bấm xuất. */
export async function downloadExcel<T>(fileName: string, sheetName: string, columns: ExcelColumn<T>[], rows: T[]) {
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: 1 }] })
  sheet.columns = columns.map((column) => ({ header: column.title, width: column.width ?? 16 }))
  sheet.getRow(1).font = { bold: true }
  rows.forEach((row) => sheet.addRow(columns.map((column) => column.value(row) ?? '')))
  columns.forEach((column, index) => {
    if (column.format) sheet.getColumn(index + 1).numFmt = formats[column.format]
  })
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } }
  await saveWorkbook(workbook, fileName)
}
