import { useEffect, useState } from 'react'

/** Giá trị chỉ đổi sau khi ngừng thay đổi `delay` ms; dùng cho ô tìm kiếm gọi BE để không gửi yêu cầu theo từng phím. */
export function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}
