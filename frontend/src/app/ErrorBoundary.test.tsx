// @vitest-environment jsdom
import { lazy, Suspense } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}) })
afterEach(() => { cleanup(); vi.restoreAllMocks() })
function Broken(): never { throw new Error('private API payload must never appear') }

test('contains a failed page while keeping navigation and hiding internal details', () => {
  render(<><nav>Menu cửa hàng</nav><ErrorBoundary homeHref="/shop"><Broken /></ErrorBoundary></>)
  expect(screen.getByText('Menu cửa hàng')).toBeTruthy()
  expect(screen.getByRole('alert')).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Trang gặp sự cố' })).toBeTruthy()
  expect(screen.queryByText(/private API payload/)).toBeNull()
  expect(screen.getByRole('link', { name: 'Về trang chính' }).getAttribute('href')).toBe('/shop')
})
test('retry remounts the failed page without reloading or clearing stored user data', () => {
  let failed = true
  function Page() { if (failed) throw new Error('temporary'); return <p>Đã phục hồi</p> }
  localStorage.setItem('recovery-test-cart', 'saved')
  render(<ErrorBoundary><Page /></ErrorBoundary>)
  failed = false
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(screen.getByText('Đã phục hồi')).toBeTruthy()
  expect(localStorage.getItem('recovery-test-cart')).toBe('saved')
  localStorage.removeItem('recovery-test-cart')
})
test('navigating to a different page resets the boundary', () => {
  const view = render(<ErrorBoundary key="/orders"><Broken /></ErrorBoundary>)
  view.rerender(<ErrorBoundary key="/customers"><p>Khách hàng</p></ErrorBoundary>)
  expect(screen.getByText('Khách hàng')).toBeTruthy()
  expect(screen.queryByRole('alert')).toBeNull()
})
test('a rejected lazy import shows reload recovery, not a retry of the cached failed import', async () => {
  const Page = lazy(() => Promise.reject(new TypeError('Failed to fetch dynamically imported module: private-url')))
  render(<ErrorBoundary><Suspense fallback={<p>Đang tải</p>}><Page /></Suspense></ErrorBoundary>)
  expect(await screen.findByRole('heading', { name: 'Không tải được trang' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Tải lại trang' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Thử lại' })).toBeNull()
  expect(screen.queryByText(/private-url/)).toBeNull()
})
