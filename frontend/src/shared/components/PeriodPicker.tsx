import { useState } from 'react'
import { DatePicker } from 'antd'
import type { RangePickerProps } from 'antd/es/date-picker'
import { ArrowRight } from 'lucide-react'
import dayjs from 'dayjs'

type PeriodPickerProps = Omit<RangePickerProps, 'separator' | 'format' | 'disabledDate'> & {
  /** Cho chọn ngày sau hôm nay (mặc định không). */
  allowFuture?: boolean
  /** Số ngày tối đa của kỳ, tính cả hai đầu (ví dụ 366). */
  maxDays?: number
}

/**
 * Ô chọn khoảng ngày dùng chung: mũi tên giữa hai ngày, ô vừa hai ngày dd/mm/yyyy.
 * Đã chọn một đầu thì khóa các ngày nằm sai phía (đang chọn ngày kết thúc thì không chọn được ngày trước ngày bắt đầu,
 * và ngược lại), nên không có chuyện chọn ngược rồi tự đảo.
 */
export function PeriodPicker({ allowFuture = false, maxDays, className, onFocus, ...props }: PeriodPickerProps) {
  const [side, setSide] = useState<'start' | 'end'>('start')
  return (
    <DatePicker.RangePicker
      {...props}
      className={className ? `af-period-picker ${className}` : 'af-period-picker'}
      format="DD/MM/YYYY"
      separator={<ArrowRight size={14} aria-hidden />}
      onFocus={(event, info) => {
        setSide(info.range ?? 'start')
        onFocus?.(event, info)
      }}
      disabledDate={(date, info) => {
        if (!allowFuture && date.isAfter(dayjs(), 'day')) return true
        const from = info?.from
        if (!from) return false
        if (side === 'end' ? date.isBefore(from, 'day') : date.isAfter(from, 'day')) return true
        return maxDays !== undefined && Math.abs(date.diff(from, 'day')) >= maxDays
      }}
    />
  )
}
