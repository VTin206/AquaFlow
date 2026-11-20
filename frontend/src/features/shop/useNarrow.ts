import { useSyncExternalStore } from 'react'

/** Màn hình hẹp hơn `width` px (khớp mốc CSS của trang đặt hàng); không có matchMedia thì coi là màn hình rộng. */
export function useNarrow(width: number) {
  const query = `(max-width: ${width}px)`
  return useSyncExternalStore(
    (notify) => {
      const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query) : null
      media?.addEventListener?.('change', notify)
      return () => media?.removeEventListener?.('change', notify)
    },
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false),
    () => false,
  )
}
