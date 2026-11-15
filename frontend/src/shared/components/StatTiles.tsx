import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'

/** Hàng ô số liệu đầu trang (Tổng quan, Báo cáo, Khách hàng): các ô bằng nhau, tự xuống hàng theo bề ngang. */
export function StatTiles({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <dl className="af-stat-tiles" aria-label={label}>
      {children}
    </dl>
  )
}

type Tone = 'due' | 'paid' | 'deposit'

/**
 * Một ô số liệu: nhãn, số lớn, đơn vị nhỏ và nhạt (₫ khi `money`), ghi chú nằm sát đáy ô.
 * `value` là chữ khi chưa có số (ví dụ "Chưa đủ giá nhập"): in nhỏ và nhạt hơn số.
 */
export function StatTile({
  title,
  value,
  money = false,
  unit,
  tone,
  note,
  loading = false,
}: {
  title: ReactNode
  value: number | string | undefined
  money?: boolean
  unit?: string
  tone?: Tone
  note?: ReactNode
  loading?: boolean
}) {
  const suffix = money ? '₫' : unit
  const text = typeof value === 'string'
  return (
    <div className="af-stat-tile">
      <dt>{title}</dt>
      <dd className={['af-stat-value', text ? 'is-text' : '', tone && !text ? `is-${tone}` : ''].filter(Boolean).join(' ')}>
        {loading ? (
          'Đang tải…'
        ) : value === undefined ? (
          '—'
        ) : text ? (
          value
        ) : (
          <>
            {value.toLocaleString('vi-VN')}
            {suffix && <small>{suffix}</small>}
          </>
        )}
      </dd>
      {/* Ô không có ghi chú vẫn giữ dòng trống để số các ô thẳng hàng với nhau. */}
      <dd className="af-stat-note">{loading ? null : note}</dd>
    </div>
  )
}

/** Mức tăng/giảm so với kỳ trước: viên nhỏ có mũi tên và dấu, nên không chỉ dựa vào màu. */
export function StatChange({ current, previous, period = 'kỳ trước' }: { current: number; previous?: number; period?: string }) {
  if (previous === undefined) return null
  const label = `so với ${period}`
  // Kỳ trước bằng 0 thì phần trăm vô nghĩa.
  if (previous === 0) return <span>{current ? `${period[0].toUpperCase()}${period.slice(1)} chưa phát sinh` : `Không đổi ${label}`}</span>
  const change = Math.round(((current - previous) / Math.abs(previous)) * 100)
  if (change === 0) return <span>Không đổi {label}</span>
  const Icon = change > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span>
      <b className={change > 0 ? 'is-up' : 'is-down'}>
        <Icon size={13} aria-hidden />
        {change > 0 ? '+' : '−'}
        {Math.abs(change).toLocaleString('vi-VN')}%
      </b>{' '}
      {label}
    </span>
  )
}

/** Ghi chú cảnh báo trong ô (ví dụ thiếu giá nhập): viên đỏ kèm chữ. */
export function StatWarning({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <span>
      <b className="is-down">{label}</b> {children}
    </span>
  )
}
