// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { App } from 'antd'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { TrackPage } from './TrackPage'

const mocks = vi.hoisted(() => ({ supported: false, phone: '0283 456 7890' as string | undefined }))

vi.mock('@/features/settings/settingsService', () => ({ useSettings: () => ({ data: undefined }) }))
vi.mock('./shopService', () => ({
  lookupOrder: vi.fn(),
  useTrackedOrder: vi.fn(),
  useShopFeature: () => mocks.supported,
  useShopContact: () => ({ phone: mocks.phone }),
}))

const renderPage = () =>
  render(
    <App>
      <MemoryRouter>
        <TrackPage />
      </MemoryRouter>
    </App>,
  )

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  })
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  mocks.supported = false
  mocks.phone = '0283 456 7890'
})
afterEach(cleanup)

test('chưa tra cứu được: cho khách số gọi cửa hàng, không có form khóa hay chữ kỹ thuật', () => {
  renderPage()
  expect(screen.getByRole('link', { name: /0283 456 7890/ }).getAttribute('href')).toBe('tel:02834567890')
  expect(screen.queryByLabelText('Mã đơn')).toBeNull()
  expect(document.body.textContent).not.toMatch(/backend|API|chưa hỗ trợ/i)
})

test('cửa hàng chưa có số điện thoại thì vẫn có hướng dẫn và lối đăng nhập', () => {
  mocks.phone = undefined
  renderPage()
  expect(screen.getByText('Vui lòng liên hệ cửa hàng để hỏi tình trạng đơn.')).toBeTruthy()
  expect(screen.getByRole('button', { name: /Đăng nhập/ })).toBeTruthy()
})

test('tra cứu được thì hiện form', () => {
  mocks.supported = true
  renderPage()
  expect(screen.getByLabelText('Mã đơn')).toBeTruthy()
  expect(screen.getByRole('button', { name: /Tra cứu/ })).toBeTruthy()
})
