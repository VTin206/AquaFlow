import { useId, type ReactNode } from 'react'

/** Một khu trong form dài: tiêu đề không đánh số, dùng chung cho mọi hộp thoại. */
export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  const id = useId()
  return (
    <section className="af-form-section" aria-labelledby={id}>
      <h3 id={id} className="af-form-section-title">
        {title}
      </h3>
      {children}
    </section>
  )
}
