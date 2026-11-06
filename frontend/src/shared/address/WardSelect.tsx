import { Select } from 'antd'
import { normalizeSearch } from '@/shared/utils/search'
import { hcmWards } from './hcmWards'

const wardOptions = hcmWards.map((ward) => ({ value: ward, label: ward, search: normalizeSearch(ward) }))

type WardSelectProps = {
  value?: string | null
  onChange?: (value: string) => void
  disabled?: boolean
  id?: string
  placeholder?: string
}

/**
 * Chọn phường/xã của TP. Hồ Chí Minh thay cho nhập tay. Gõ không dấu vẫn tìm được ("ben thanh").
 * Dữ liệu cũ ghi theo quận ("Gò Vấp") vẫn hiện nguyên để không mất khi sửa, đến lúc người dùng chọn lại.
 */
export function WardSelect({ value, onChange, disabled, id, placeholder = 'Chọn phường/xã' }: WardSelectProps) {
  const current = value?.trim()
  const legacy = current && !hcmWards.includes(current) ? [{ value: current, label: `${current} (cũ, chọn lại)`, search: normalizeSearch(current) }] : []
  return (
    <Select
      id={id}
      showSearch={{ filterOption: (input, option) => Boolean(option?.search.includes(normalizeSearch(input))) }}
      allowClear
      disabled={disabled}
      placeholder={placeholder}
      value={current || undefined}
      onChange={(next?: string) => onChange?.(next ?? '')}
      options={[...legacy, ...wardOptions]}
      notFoundContent="Không có phường/xã này ở TP. Hồ Chí Minh"
      style={{ width: '100%' }}
    />
  )
}
