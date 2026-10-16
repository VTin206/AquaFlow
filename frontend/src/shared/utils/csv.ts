type Cell = string | number | undefined | null

/** Tải bảng dữ liệu thành tệp CSV mở được bằng Excel (UTF-8 có BOM để giữ dấu tiếng Việt). */
export function downloadCsv(filename: string, rows: Cell[][]) {
  const escape = (cell: Cell) => {
    const text = cell == null ? '' : String(cell)
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }
  const csv = rows.map((row) => row.map(escape).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
