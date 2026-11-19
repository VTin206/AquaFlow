// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { DeliveryAreaNotice } from './DeliveryAreaNotice'

beforeEach(() => {
  localStorage.clear()
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
})
afterEach(cleanup)

test('lần đầu vào hỏi khu vực và nói rõ chỉ giao TP.HCM cũ; trả lời có thì không hỏi lại', () => {
  const first = render(<DeliveryAreaNotice phone="0287 779 990" />)
  expect(screen.getByText('Bạn đang ở TP. Hồ Chí Minh?')).toBeTruthy()
  expect(screen.getByText(/chỉ giao trong TP\. Hồ Chí Minh cũ, chưa gồm Bình Dương, Bà Rịa - Vũng Tàu/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Có, tôi ở TP.HCM' }))
  first.unmount()
  cleanup()
  render(<DeliveryAreaNotice phone="0287 779 990" />)
  expect(screen.queryByText('Bạn đang ở TP. Hồ Chí Minh?')).toBeNull()
})

test('khách ở nơi khác được báo chưa giao tới, có hotline và vẫn xem được sản phẩm', () => {
  render(<DeliveryAreaNotice phone="0287 779 990" />)
  fireEvent.click(screen.getByRole('button', { name: 'Tôi ở nơi khác' }))
  expect(screen.getByText('Chưa giao tới khu vực của bạn')).toBeTruthy()
  expect(screen.getByRole('link', { name: '0287 779 990' }).getAttribute('href')).toBe('tel:0287779990')
  expect(screen.getByRole('button', { name: 'Vẫn xem sản phẩm' })).toBeTruthy()
  expect(localStorage.getItem('aquaflow.shop.delivery-area-answered')).toBe('out')
})
