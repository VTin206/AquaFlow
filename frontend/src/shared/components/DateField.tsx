import { DatePicker } from 'antd'
import dayjs from 'dayjs'

type DateFieldProps = {
  /** Ngày dạng `YYYY-MM-DD`, đúng định dạng API. */
  value?: string
  onChange?: (value: string) => void
  /** Giới hạn dạng `YYYY-MM-DD`; ngày ngoài khoảng bị khóa trên lịch. */
  min?: string
  max?: string
  id?: string
  disabled?: boolean
}

/**
 * Ô chọn ngày cho form: hiển thị `DD/MM/YYYY` như phần còn lại của hệ thống nhưng giữ giá trị `YYYY-MM-DD` trong form.
 * Dùng thay `<input type="date">`, vốn hiển thị theo ngôn ngữ của trình duyệt (ví dụ 11/16/2026).
 */
export function DateField({ value, onChange, min, max, id, disabled }: DateFieldProps) {
  return (
    <DatePicker
      id={id}
      disabled={disabled}
      format="DD/MM/YYYY"
      placeholder="dd/mm/yyyy"
      style={{ width: '100%' }}
      value={value ? dayjs(value) : null}
      onChange={(date) => onChange?.(date ? date.format('YYYY-MM-DD') : '')}
      disabledDate={(date) => {
        const iso = date.format('YYYY-MM-DD')
        return Boolean((min && iso < min) || (max && iso > max))
      }}
    />
  )
}
