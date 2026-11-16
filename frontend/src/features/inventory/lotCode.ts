/**
 * Mã lô gợi ý khi nhập kho: mã hàng ghép ngày nhận (`SATORI-19L-161126`).
 * Chỉ là gợi ý cho hàng không in mã lô; hàng có mã trên bao bì thì nhân viên gõ đè lên.
 */
export function suggestLotCode(sku: string | undefined, receivedAt: string | undefined) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(receivedAt ?? '')
  if (!sku?.trim() || !match) return ''
  const [, year, month, day] = match
  return `${sku.trim()}-${day}${month}${year.slice(2)}`
}
