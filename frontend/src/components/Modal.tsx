import type { ReactNode } from 'react'
import { X } from 'lucide-react'

type ModalProps = {
  titleId: string
  eyebrow: string
  title: string
  className?: string
  onClose: () => void
  children: ReactNode
}

export function Modal({ titleId, eyebrow, title, className = '', onClose, children }: ModalProps) {
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section className={`modal-card ${className}`.trim()} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal-header">
          <div>
            <span className="eyebrow">{eyebrow}</span>
            <h2 id={titleId}>{title}</h2>
          </div>
          <button className="icon-button" aria-label="Đóng" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>
  )
}
