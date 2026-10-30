import { useSyncExternalStore } from 'react'

export type ColorMode = 'light' | 'dark' | 'system'

const KEY = 'aquaflow.color-mode'
const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null

const read = (): ColorMode => {
  try {
    const stored = localStorage.getItem(KEY)
    return stored === 'dark' || stored === 'system' ? stored : 'light'
  } catch {
    return 'light'
  }
}

let mode = read()
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())
media?.addEventListener('change', notify)

export function setColorMode(next: ColorMode) {
  mode = next
  try {
    localStorage.setItem(KEY, next)
  } catch {
    // Không lưu được thì lần sau về chế độ sáng.
  }
  notify()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Chế độ người dùng chọn ('system' theo cài đặt máy) và chế độ thực tế đang hiển thị. */
export function useColorMode() {
  const selected = useSyncExternalStore(subscribe, () => mode)
  const systemDark = useSyncExternalStore(subscribe, () => media?.matches ?? false)
  const dark = selected === 'dark' || (selected === 'system' && systemDark)
  return { selected, dark }
}
