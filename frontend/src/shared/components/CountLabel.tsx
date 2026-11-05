import { ToneLabel, type Tone } from './ToneLabel'

/** Nhãn kèm số đếm dạng viên thuốc, dùng cho tab lọc: "Chờ xác nhận (1)" → "Chờ xác nhận ①". */
export function CountLabel({ label, count, urgent = false, tone }: { label: string; count: number; urgent?: boolean; tone?: Tone }) {
  const content = (
    <span className="af-count-label">
      {label}
      <span className={`af-count ${urgent && count > 0 ? 'is-urgent' : ''}`}>{count}</span>
    </span>
  )
  return tone ? <ToneLabel tone={tone}>{content}</ToneLabel> : content
}
