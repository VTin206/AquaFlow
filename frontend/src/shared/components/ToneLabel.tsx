import type { ReactNode } from 'react'

export type Tone = 'success' | 'warning' | 'danger' | 'neutral'

/** Nhãn tô chữ theo màu trạng thái; trong Segmented, ô đang chọn tô thêm nền nhạt cùng màu (xem global.css). */
export function ToneLabel({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`af-tone is-${tone}`}>{children}</span>
  )
}
