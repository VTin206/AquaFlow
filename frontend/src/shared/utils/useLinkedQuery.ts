import { useState } from 'react'
import { useSearchParams } from 'react-router'

/** Ô tìm kiếm nhận từ khóa từ `?q=` (tìm nhanh mở trang); bấm kết quả khác khi đang ở trang này thì cập nhật theo. */
export function useLinkedQuery() {
  const linked = useSearchParams()[0].get('q') ?? ''
  const [query, setQuery] = useState(linked)
  const [applied, setApplied] = useState(linked)
  if (linked !== applied) {
    setApplied(linked)
    if (linked) setQuery(linked)
  }
  return [query, setQuery] as const
}
