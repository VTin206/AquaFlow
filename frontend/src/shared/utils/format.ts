const numberFormat = new Intl.NumberFormat('vi-VN')

export const currency = (amount: number) => `${numberFormat.format(amount)} ₫`

/** 2_600_000 → "2,6 tr" — dùng cho trục biểu đồ, nhãn ngắn. */
export const compactCurrency = (amount: number) =>
  amount >= 1_000_000 ? `${(amount / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr` : `${numberFormat.format(Math.round(amount / 1000))} k`

/** "2026-10-16" → "T6 16/10" */
export const shortDate = (isoDate: string) => {
  const date = new Date(`${isoDate}T00:00:00`)
  const weekday = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][date.getDay()]
  return `${weekday} ${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** Ngày giờ in trên chứng từ: "16/10/2026 20:30". */
export const printDate = (value = new Date()) =>
  value.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
