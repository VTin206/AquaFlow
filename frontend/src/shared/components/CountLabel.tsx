import { ToneLabel, type Tone } from './ToneLabel'

/**
 * Nhãn kèm số đếm dạng viên thuốc, dùng cho tab lọc: "Chờ xác nhận (1)" → "Chờ xác nhận ①".
 * Không truyền tone (ô "Tất cả") thì dùng neutral: ô đang chọn chữ đen, giống trang Đơn hàng.
 */
export function CountLabel({
  label,
  count,
  urgent = false,
  tone = 'neutral',
}: {
  label: string
  count: number
  urgent?: boolean
  tone?: Tone
}) {
  return (
    <ToneLabel tone={tone}>
      <span className="af-count-label">
        {label}
        <span className={`af-count ${urgent && count > 0 ? 'is-urgent' : ''}`}>{count}</span>
      </span>
    </ToneLabel>
  )
}
