/** Một loại vỏ của đơn: số đã giao, đã thu và mức cọc chốt khi khởi hành. */
export type DepositLine = { bottleTypeId: number; name: string; given: number; returned: number; unitDeposit: number }

/**
 * Cọc phải thu cho phần vỏ khách chưa đổi: (giao − đã thu − đang nhập) × cọc/vỏ, theo từng loại.
 * `entering` là số vỏ tài xế đang nhập trong form, chưa ghi sổ.
 */
export function depositShortfall(lines: DepositLine[], entering: Record<string, number | undefined> = {}) {
  const rows = lines.map((line) => {
    const short = Math.max(0, line.given - line.returned - (entering[String(line.bottleTypeId)] ?? 0))
    return { bottleTypeId: line.bottleTypeId, name: line.name, short, amount: short * line.unitDeposit }
  })
  return {
    rows,
    bottles: rows.reduce((sum, row) => sum + row.short, 0),
    total: rows.reduce((sum, row) => sum + row.amount, 0),
  }
}
