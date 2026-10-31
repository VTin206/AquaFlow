import type { ReactNode } from 'react'

export type Tone = 'success' | 'warning' | 'danger' | 'neutral'

/** Nhãn trạng thái; trong Segmented, ô đang chọn đổi chữ và nền theo màu trạng thái (xem global.css). */
export function ToneLabel({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`af-tone is-${tone}`}>{children}</span>
  )
}
