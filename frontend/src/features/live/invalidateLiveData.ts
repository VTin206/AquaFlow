import type { QueryClient } from '@tanstack/react-query'

/** Các form và trang công khai cùng sử dụng danh mục; làm mới sau khi ghi thành công. */
export function invalidateLiveData(client: QueryClient) {
  return client.invalidateQueries({
    predicate: ({ queryKey }) => queryKey[0] === 'live' || (queryKey[0] === 'shop' && queryKey.includes('live')),
  })
}
