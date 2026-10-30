const numberFormat = new Intl.NumberFormat('vi-VN')

export const currency = (amount: number) => `${numberFormat.format(amount)} ₫`

/** 2_600_000 → "2,6 tr" — dùng cho trục biểu đồ, nhãn ngắn. */
export const compactCurrency = (amount: number) =>
  amount === 0
    ? '0'
    : Math.abs(amount) >= 1_000_000
      ? `${(amount / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr`
      : `${numberFormat.format(Math.round(amount / 1000))} k`

/** "2026-10-16" → "T6 16/10" */
export const shortDate = (isoDate: string) => {
  const date = new Date(`${isoDate}T00:00:00`)
  const weekday = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][date.getDay()]
  return `${weekday} ${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** Ngày giờ in trên chứng từ: "16/10/2026 20:30". */
export const printDate = (value = new Date()) =>
  value.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const timeOf = (date: Date) => date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

/** Giờ kèm ngày khi cần: "13:10" hôm nay, "Hôm qua 13:10", "28/10 13:10" trong năm, "28/10/2025" năm khác. */
export const relativeDateTime = (iso: string, now = new Date()) => {
  const date = new Date(iso)
  const dayDiff = Math.round((new Date(now.toDateString()).getTime() - new Date(date.toDateString()).getTime()) / 86_400_000)
  if (dayDiff === 0) return timeOf(date)
  if (dayDiff === 1) return `Hôm qua ${timeOf(date)}`
  const day = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`
  return date.getFullYear() === now.getFullYear() ? `${day} ${timeOf(date)}` : `${day}/${date.getFullYear()}`
}
