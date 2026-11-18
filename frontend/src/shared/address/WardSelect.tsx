import { Select } from 'antd'
import { normalizeSearch } from '@/shared/utils/search'
import { DELIVERY_AREA, deliveryWards, hcmWards } from './hcmWards'

const wardOptions = deliveryWards.map((ward) => ({ value: ward, label: ward, search: normalizeSearch(ward) }))

type WardSelectProps = {
  value?: string | null
  onChange?: (value: string) => void
  disabled?: boolean
  id?: string
  placeholder?: string
  ariaLabel?: string
}

/**
 * Chọn phường/xã thay cho nhập tay, chỉ trong địa bàn TP. Hồ Chí Minh cũ (chưa gồm Bình Dương, Bà Rịa - Vũng Tàu).
 * Gõ không dấu vẫn tìm được ("ben thanh"). Giá trị đã lưu nằm ngoài danh sách (ghi theo quận như "Gò Vấp", hoặc phường
 * ngoài khu vực giao) vẫn hiện nguyên để không mất khi sửa, đến lúc người dùng chọn lại.
 */
export function WardSelect({ value, onChange, disabled, id, placeholder = 'Chọn phường/xã', ariaLabel }: WardSelectProps) {
  const current = value?.trim()
  const note = current && hcmWards.includes(current) ? 'ngoài khu vực giao, chọn lại' : 'cũ, chọn lại'
  const legacy = current && !deliveryWards.includes(current) ? [{ value: current, label: `${current} (${note})`, search: normalizeSearch(current) }] : []
  return (
    <Select
      id={id}
      aria-label={ariaLabel}
      showSearch={{ filterOption: (input, option) => Boolean(option?.search.includes(normalizeSearch(input))) }}
      allowClear
      disabled={disabled}
      placeholder={placeholder}
      value={current || undefined}
      onChange={(next?: string) => onChange?.(next ?? '')}
      options={[...legacy, ...wardOptions]}
      notFoundContent={`Không có phường/xã này trong khu vực ${DELIVERY_AREA}`}
      style={{ width: '100%' }}
    />
  )
}
