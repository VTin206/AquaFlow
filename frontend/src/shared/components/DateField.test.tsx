// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { DateField } from './DateField'

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})
afterEach(cleanup)

test('hiển thị ngày kiểu Việt Nam và trả giá trị YYYY-MM-DD khi gõ ngày', () => {
  const onChange = vi.fn()
  render(<DateField value="2026-11-16" onChange={onChange} />)
  const input = screen.getByPlaceholderText('dd/mm/yyyy') as HTMLInputElement
  expect(input.value).toBe('16/11/2026')
  fireEvent.mouseDown(input)
  fireEvent.change(input, { target: { value: '05/12/2026' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(onChange).toHaveBeenLastCalledWith('2026-12-05')
})

test('ô trống khi chưa có ngày', () => {
  render(<DateField />)
  expect((screen.getByPlaceholderText('dd/mm/yyyy') as HTMLInputElement).value).toBe('')
})
