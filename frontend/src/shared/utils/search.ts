/** Tìm tiếng Việt không phân biệt dấu, hoa/thường và khoảng trắng thừa. */
export const normalizeSearch = (text: string) => text
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[đĐ]/g, 'd')
  .toLowerCase()
  .trim()
  .replace(/\s+/g, ' ')

const phoneDigits = (text: string) => text.replace(/\D/g, '').replace(/^84(?=\d{9,10}$)/, '0')

/** Giữ tìm theo chuỗi cho tên/mã; chỉ bỏ dấu phân cách khi từ khóa là số điện thoại. */
export function matchesSearch(query: string, text: string, phone?: string) {
  const keyword = normalizeSearch(query)
  if (!keyword || normalizeSearch(text).includes(keyword)) return true
  return Boolean(phone && /^[+\d\s().-]+$/.test(keyword) && /\d/.test(keyword)
    && phoneDigits(phone).includes(phoneDigits(keyword)))
}
