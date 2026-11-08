import { hcmWards } from './hcmWards'

/**
 * Tách một địa chỉ một dòng thành số nhà/đường và phường/xã. Chỉ tách khi đoạn cuối đúng là phường/xã trong danh sách
 * (bỏ qua đuôi "TP. Hồ Chí Minh"); địa chỉ cũ ghi theo quận giữ nguyên trong ô số nhà/đường để không mất chữ nào.
 */
export function splitAddressLine(value = '') {
  const parts = value.split(',').map((part) => part.trim()).filter(Boolean)
  const withoutCity = /^(tp\.?\s*)?(thành phố\s*)?hồ chí minh$/i.test(parts.at(-1) ?? '') ? parts.slice(0, -1) : parts
  const last = withoutCity.at(-1)
  return last && hcmWards.includes(last) ? { street: withoutCity.slice(0, -1).join(', '), ward: last } : { street: value.trim(), ward: '' }
}

export const joinAddressLine = (street: string, ward: string) => [street.trim(), ward].filter(Boolean).join(', ')
