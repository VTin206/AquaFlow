import type { KeyboardEvent } from 'react'

const TEXT_TYPES = new Set(['text', 'email', 'tel', 'password', 'number', 'search', 'url'])

/** Ô nhập chữ đang hiện và dùng được; ô chọn (Select) có role combobox nên không tính. */
const isTextField = (element: Element): element is HTMLInputElement | HTMLTextAreaElement =>
  (element instanceof HTMLTextAreaElement || (element instanceof HTMLInputElement && TEXT_TYPES.has(element.type) && element.getAttribute('role') !== 'combobox'))
  && !element.disabled && !element.readOnly && (element as HTMLElement).offsetParent !== null

/**
 * Gắn vào `onKeyDown` của Form: Enter ở ô nhập chữ chuyển sang ô nhập chữ kế tiếp;
 * ở ô cuối thì để Enter gửi form như bình thường. Ô nhiều dòng giữ Enter để xuống dòng.
 */
export function focusNextOnEnter(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
  const target = event.target as Element
  if (target instanceof HTMLTextAreaElement || !isTextField(target)) return
  const fields = [...event.currentTarget.querySelectorAll('input, textarea')].filter(isTextField)
  const next = fields[fields.indexOf(target) + 1]
  if (!next) return
  event.preventDefault()
  next.focus()
}
