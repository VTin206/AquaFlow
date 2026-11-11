// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { deliveryWards, hcmWards } from './hcmWards'
import { WardSelect } from './WardSelect'

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  })
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
})
afterEach(cleanup)

test('danh sách đủ 168 đơn vị của TP. Hồ Chí Minh, không trùng', () => {
  expect(hcmWards).toHaveLength(168)
  expect(new Set(hcmWards).size).toBe(168)
  expect(hcmWards.filter((ward) => ward.startsWith('Phường '))).toHaveLength(113)
  expect(hcmWards.filter((ward) => ward.startsWith('Xã '))).toHaveLength(54)
  expect(hcmWards).toContain('Đặc khu Côn Đảo')
})

test('khu vực giao chỉ gồm 102 đơn vị của TP. Hồ Chí Minh cũ', () => {
  expect(deliveryWards).toHaveLength(102)
  expect(deliveryWards.filter((ward) => ward.startsWith('Phường '))).toHaveLength(78)
  expect(deliveryWards.filter((ward) => ward.startsWith('Xã '))).toHaveLength(24)
  expect(deliveryWards).toContain('Xã Thạnh An')
  for (const outside of ['Phường Thủ Dầu Một', 'Phường Dĩ An', 'Phường Vũng Tàu', 'Xã Thanh An', 'Đặc khu Côn Đảo']) expect(deliveryWards).not.toContain(outside)
})

test('phường ngoài khu vực giao đã lưu vẫn hiện và nhắc chọn lại', () => {
  render(<WardSelect value="Phường Dĩ An" />)
  expect(screen.getByText('Phường Dĩ An (ngoài khu vực giao, chọn lại)')).toBeTruthy()
})

test('gõ không dấu vẫn tìm được và trả về đúng tên phường', async () => {
  const onChange = vi.fn()
  render(<WardSelect id="ward" onChange={onChange} />)
  const box = screen.getByRole('combobox')
  fireEvent.mouseDown(box)
  fireEvent.change(box, { target: { value: 'tan dinh' } })
  fireEvent.click(await screen.findByTitle('Phường Tân Định'))
  expect(onChange).toHaveBeenCalledWith('Phường Tân Định')
})

test('khu vực cũ theo quận vẫn hiện nguyên và nhắc chọn lại', () => {
  render(<WardSelect value="Gò Vấp" />)
  expect(screen.getByText('Gò Vấp (cũ, chọn lại)')).toBeTruthy()
})
