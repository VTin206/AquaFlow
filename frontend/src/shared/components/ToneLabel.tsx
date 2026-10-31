import type { ReactNode } from 'react'

export type Tone = 'success' | 'warning' | 'danger' | 'neutral'

/** Nhãn có chấm màu theo trạng thái; trong Segmented, ô đang chọn tô nền cùng màu (xem global.css). */
export function ToneLabel({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`af-tone is-${tone}`}>
      <i className="af-tone-dot" aria-hidden />
      {children}
    </span>
  )
}
