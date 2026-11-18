// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { WaitingOrdersCard, type WaitingOrder } from './WaitingOrdersCard'

const orders: WaitingOrder[] = [
  { id: '1', code: 'DH-1', customer: 'Anh Minh', address: '12 Lê Lợi', jugs: 2, due: 0, redelivery: false },
  { id: '2', code: 'DH-2', customer: 'Chị Lan', address: '5 Hai Bà Trưng', jugs: 1, due: 0, redelivery: false },
]

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn(() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })),
  })
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

const show = (selected: string[], onSelect = vi.fn()) => {
  render(<WaitingOrdersCard orders={orders} loading={false} selected={selected} onSelect={onSelect} onCreate={() => {}} />)
  return onSelect
}

test('bấm vào chữ trên dòng thì chọn đơn, bấm lại thì bỏ chọn', () => {
  expect(show([]).mock.calls).toEqual([])
  const onSelect = vi.fn()
  cleanup()
  show(['1'], onSelect)
  fireEvent.click(screen.getByText('Chị Lan'))
  expect(onSelect).toHaveBeenLastCalledWith(['1', '2'])
  fireEvent.click(screen.getByText('Anh Minh'))
  expect(onSelect).toHaveBeenLastCalledWith([])
})

test('bấm đúng ô vuông chỉ đổi một lần', () => {
  const onSelect = show([])
  const [, first] = screen.getAllByRole('checkbox') // ô đầu tiên là "chọn tất cả"
  fireEvent.click(first)
  expect(onSelect).toHaveBeenCalledTimes(1)
  expect(onSelect.mock.calls[0][0]).toEqual(['1'])
})
