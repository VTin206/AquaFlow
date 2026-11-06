import { useState } from 'react'
import { Input } from 'antd'
import { joinAddressLine, splitAddressLine } from './addressLine'
import { HCM_CITY } from './hcmWards'
import { WardSelect } from './WardSelect'

type AddressLineFieldProps = { value?: string; onChange?: (value: string) => void; label: string }

/** Một địa chỉ giao hàng lưu dạng một dòng, nhập bằng hai ô: số nhà/đường và phường/xã TP. Hồ Chí Minh. */
export function AddressLineField({ value = '', onChange, label }: AddressLineFieldProps) {
  const { street, ward } = splitAddressLine(value)
  // Giữ nguyên chữ đang gõ (kể cả dấu cách cuối); giá trị gửi lên form thì đã cắt khoảng trắng thừa.
  const [draft, setDraft] = useState(street)
  const [seen, setSeen] = useState(value)
  if (value !== seen) {
    setSeen(value)
    if (street !== draft.trim()) setDraft(street)
  }
  return (
    <div className="af-address-line">
      <Input
        aria-label={label}
        placeholder="Số nhà, tên đường"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value)
          onChange?.(joinAddressLine(event.target.value, ward))
        }}
      />
      <WardSelect ariaLabel={`Phường/xã của ${label.toLowerCase()} (${HCM_CITY})`} value={ward} onChange={(next) => onChange?.(joinAddressLine(draft, next))} />
    </div>
  )
}
