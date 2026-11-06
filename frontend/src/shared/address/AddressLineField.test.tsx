// @vitest-environment jsdom
import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AddressLineField } from './AddressLineField'

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  })
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
})
afterEach(cleanup)

function Harness({ initial = '', onValue }: { initial?: string; onValue: (value: string) => void }) {
  const [value, setValue] = useState(initial)
  return <AddressLineField label="Địa chỉ 1" value={value} onChange={(next) => { setValue(next); onValue(next) }} />
}

test('gõ được địa chỉ nhiều chữ và chọn phường, giá trị ghép thành một dòng', async () => {
  const onValue = vi.fn()
  render(<Harness onValue={onValue} />)
  const street = screen.getByLabelText('Địa chỉ 1') as HTMLInputElement
  for (const text of ['12', '12 ', '12 L', '12 Lê ', '12 Lê Lợi']) fireEvent.change(street, { target: { value: text } })
  expect(street.value).toBe('12 Lê Lợi')
  const ward = screen.getByRole('combobox')
  fireEvent.mouseDown(ward)
  fireEvent.change(ward, { target: { value: 'ben thanh' } })
  fireEvent.click(await screen.findByTitle('Phường Bến Thành'))
  expect(onValue).toHaveBeenLastCalledWith('12 Lê Lợi, Phường Bến Thành')
  fireEvent.change(street, { target: { value: '12 Lê Lợi ' } })
  expect(street.value).toBe('12 Lê Lợi ')
  expect(onValue).toHaveBeenLastCalledWith('12 Lê Lợi, Phường Bến Thành')
})

test('mở địa chỉ đã lưu thì tách đúng hai ô', () => {
  render(<Harness initial="5 Hẻm 3, Phường Tân Định" onValue={vi.fn()} />)
  expect((screen.getByLabelText('Địa chỉ 1') as HTMLInputElement).value).toBe('5 Hẻm 3')
  expect(screen.getByTitle('Phường Tân Định')).toBeTruthy()
})
