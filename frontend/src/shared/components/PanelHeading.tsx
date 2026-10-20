import type { ReactNode } from 'react'

/** Tiêu đề và thao tác tự xuống dòng khi thẻ không đủ rộng. */
export function PanelHeading({ title, extra }: { title: ReactNode; extra?: ReactNode }) {
  return (
    <div className="af-panel-heading">
      <span className="af-panel-heading-title">{title}</span>
      {extra && <span className="af-panel-heading-extra">{extra}</span>}
    </div>
  )
}
