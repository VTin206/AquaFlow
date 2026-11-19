// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { WaitingOrdersCard, type WaitingOrder } from './WaitingOrdersCard'

const orders: WaitingOrder[] = [
  { id: '1', code: 'DH-1', customer: 'Anh Minh', address: '12 Lê Lợi', jugs: 2, units: 2, due: 0, redelivery: false },
  { id: '2', code: 'DH-2', customer: 'Chị Lan', address: '5 Hai Bà Trưng', jugs: 1, units: 1, due: 0, redelivery: false },
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

test('lọc theo phường, đơn cùng phường nằm cạnh nhau và nút tạo chuyến ghi tổng số bình', async () => {
  const mixed: WaitingOrder[] = [
    { id: '1', code: 'DH-1', customer: 'Anh Minh', address: '12 Lê Lợi', area: 'Phường Bến Thành', jugs: 2, due: 0, redelivery: false },
    { id: '2', code: 'DH-2', customer: 'Chị Lan', address: '5 Hai Bà Trưng', area: 'Phường Tân Định', jugs: 1, due: 0, redelivery: false },
    { id: '3', code: 'DH-3', customer: 'Cô Hoa', address: '40 Lý Tự Trọng', area: 'Phường Bến Thành', jugs: 3, due: 0, redelivery: false },
  ]
  render(<WaitingOrdersCard orders={mixed} loading={false} selected={['1', '3']} onSelect={() => {}} onCreate={() => {}} />)
  const names = () => screen.getAllByText(/^(Anh Minh|Chị Lan|Cô Hoa)$/).map((cell) => cell.textContent)
  expect(names()).toEqual(['Anh Minh', 'Cô Hoa', 'Chị Lan'])
  expect(screen.getByRole('button', { name: /Tạo chuyến \(2 đơn · 5 bình\)/ })).toBeTruthy()
  fireEvent.mouseDown(screen.getByLabelText('Lọc theo phường'))
  fireEvent.click(await screen.findByText('Phường Tân Định · 1 đơn · 1 bình'))
  expect(names()).toEqual(['Chị Lan'])
})
