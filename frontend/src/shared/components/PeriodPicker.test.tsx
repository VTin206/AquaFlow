// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import dayjs from 'dayjs'
import { PeriodPicker } from './PeriodPicker'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-15T10:00:00'))
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn(() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })),
  })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const cell = (date: string) => document.querySelector(`td[title="${date}"]`) as HTMLElement
const disabled = (date: string) => cell(date).className.includes('ant-picker-cell-disabled')

test('chọn ngày bắt đầu rồi thì không chọn được ngày kết thúc trước nó; không chọn được ngày tương lai', () => {
  const { container } = render(<PeriodPicker open defaultPickerValue={[dayjs('2026-11-01'), dayjs('2026-11-01')]} />)
  fireEvent.focus(container.querySelectorAll('input')[0])
  fireEvent.click(cell('2026-11-10'))
  expect(disabled('2026-11-05')).toBe(true)
  expect(disabled('2026-11-12')).toBe(false)
  expect(disabled('2026-11-20')).toBe(true)
})
