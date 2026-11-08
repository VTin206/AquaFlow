// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App as AntApp } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import type { ReactNode } from 'react'
import { AuthContext, type AuthUser } from '@/features/auth/authContext'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { useAuth } from '@/features/auth/useAuth'
import { useStaff } from '@/features/auth/useStaff'
import { authService } from '@/features/auth/authService'
import { RequireAuth } from '@/app/RequireAuth'
import { RequireCustomer } from '@/app/RequireCustomer'
import { CustomerOrderPage, CustomerOrdersPage } from '@/features/shop/CustomerOrdersPage'
import { customerOrderApi } from '@/features/shop/customerOrderApi'
import { OrderDeliveryHistory } from './OrderDeliveryHistory'
import { orderDeliveryHistory } from './orderDeliveryApi'
import { ApiError } from '@/shared/api/client'
import type { LiveOrder } from '@/features/live/orderApi'
import { orderApi } from '@/features/live/orderApi'
import { dispatchApi, type DispatchReceipt } from '@/features/live/dispatchApi'
import { LiveOrderDetails } from '@/features/live/LiveOrderDetails'
vi.mock('@/features/live/paymentApi', async original => {
  const actual = await original<typeof import('@/features/live/paymentApi')>()
  actual.paymentApi.list = vi.fn().mockResolvedValue({ balance: { orderId: 12, orderCode: 'ORDER-12', customerId: 5, status: 'PREPARING', total: 10000, received: 0, refunded: 0, paid: 0, due: 10000, refundDue: 0 }, payments: [] })
  return actual
})

vi.mock('@/features/auth/authService', () => ({ authService: { login: vi.fn(), me: vi.fn() } }))
vi.mock('@/features/shop/customerOrderApi', () => ({ customerOrderApi: { list: vi.fn(), detail: vi.fn() } }))
vi.mock('@/features/live/catalogApi', () => ({ catalogApi: { products: vi.fn().mockResolvedValue([]) } }))
vi.mock('./orderDeliveryApi', () => ({ orderDeliveryHistory: vi.fn() }))
vi.mock('@/features/live/orderApi', async (original) => ({
  ...(await original<typeof import('@/features/live/orderApi')>()),
  orderApi: { detail: vi.fn(), updateStatus: vi.fn() },
}))
vi.mock('@/features/live/dispatchApi', async (original) => ({
  ...(await original<typeof import('@/features/live/dispatchApi')>()),
  dispatchApi: { create: vi.fn(), list: vi.fn() },
}))
vi.mock('@/features/settings/settingsService', () => ({ useSettings: () => ({ data: undefined }) }))
const customer = { name: 'Customer', email: 'customer@test.com', role: 'CUSTOMER' }
const order: LiveOrder = {
  id: 12,
  orderCode: 'ORDER-12',
  customerId: 5,
  createdBy: 7,
  channel: 'WEB',
  fulfillmentType: 'DELIVERY',
  status: 'PREPARING',
  paymentStatus: 'UNPAID',
  recipientName: 'Customer',
  recipientPhone: '0901234567',
  deliveryAddress: 'Address',
  deliveryArea: null,
  requestedDeliveryAt: null,
  subtotal: 10000,
  discountAmount: 0,
  deliveryFee: 0,
  total: 10000,
  createdAt: '2026-11-05T01:00:00Z',
  confirmedAt: null,
  cancelledAt: null,
  note: null,
  items: [],
}
const clients: QueryClient[] = []
function Providers({ children, user = customer, path = '/shop/orders' }: { children: ReactNode; user?: AuthUser | null; path?: string }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  clients.push(client)
  return (
    <QueryClientProvider client={client}>
      <AntApp>
        <AuthContext.Provider
          value={{
            user,
            isAuthenticated: !!user,
            login: vi.fn(),
            logout: vi.fn(),
            enterDemo: vi.fn(),
            demoGuest: false,
            enterDemoGuest: vi.fn(),
            updateProfile: vi.fn(),
          }}
        >
          <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
        </AuthContext.Provider>
      </AntApp>
    </QueryClientProvider>
  )
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(customerOrderApi.list).mockReset()
  vi.mocked(customerOrderApi.detail).mockReset()
  vi.mocked(orderDeliveryHistory).mockReset()
  vi.mocked(orderApi.detail).mockReset()
  vi.mocked(dispatchApi.create).mockReset()
  vi.mocked(dispatchApi.list).mockResolvedValue([])
  vi.stubGlobal('ResizeObserver', class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn() })
  const getStyle = window.getComputedStyle.bind(window)
  vi.spyOn(window, 'getComputedStyle').mockImplementation(element => getStyle(element))
  localStorage.clear()
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi
      .fn()
      .mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
  })
})

describe('counter handover', () => {
  const staff = { name: 'Sales', email: 'sales@test.com', role: 'SALES_STAFF' }
  const counter: LiveOrder = { ...order, channel: 'COUNTER', fulfillmentType: 'COUNTER' }
  const receipt: DispatchReceipt = { id: 1, orderId: 12, performedBy: 7, dispatchedAt: '2026-11-06T01:00:00Z', orderStatus: 'DELIVERED', items: [] }
  const show = (value = counter, role = 'SALES_STAFF') => {
    vi.mocked(orderApi.detail).mockResolvedValue(value)
    vi.mocked(orderDeliveryHistory).mockResolvedValue([])
    render(<Providers user={{ ...staff, role }}><LiveOrderDetails id={12} onClose={vi.fn()} /></Providers>)
  }

  it('confirms once, locks cancellation during dispatch, and refreshes order and receipts without marking paid', async () => {
    let finish!: (value: DispatchReceipt) => void
    vi.mocked(dispatchApi.create).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    show()
    fireEvent.click(await screen.findByRole('button', { name: /Bàn giao tại quầy/ }))
    expect(dispatchApi.create).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận bàn giao' }))
    await waitFor(() => expect(dispatchApi.create).toHaveBeenCalledExactlyOnceWith(12))
    expect((screen.getByRole('button', { name: /Bàn giao tại quầy/ }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Hủy đơn' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /Bàn giao tại quầy/ }))
    expect(dispatchApi.create).toHaveBeenCalledTimes(1)
    vi.mocked(orderApi.detail).mockResolvedValue({ ...counter, status: 'DELIVERED' })
    vi.mocked(dispatchApi.list).mockResolvedValue([receipt])
    finish(receipt)
    expect(await screen.findByText('Khách đã nhận hàng')).toBeTruthy()
    await waitFor(() => expect(screen.queryByRole('button', { name: /Bàn giao tại quầy/ })).toBeNull())
    expect(await screen.findByText('1 phiếu')).toBeTruthy()
    expect(screen.getByText('Chưa thanh toán')).toBeTruthy()
    expect(orderApi.updateStatus).not.toHaveBeenCalled()
  })

  it('shows an API failure and keeps a preparing order available to retry', async () => {
    vi.mocked(dispatchApi.create).mockRejectedValue(new ApiError(409, 'Lô hàng đã hết hạn'))
    show(counter, 'ADMIN')
    fireEvent.click(await screen.findByRole('button', { name: /Bàn giao tại quầy/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận bàn giao' }))
    expect(await screen.findByText('Lô hàng đã hết hạn')).toBeTruthy()
    await waitFor(() => expect((screen.getByRole('button', { name: /Bàn giao tại quầy/ }) as HTMLButtonElement).disabled).toBe(false))
    expect(orderApi.detail).toHaveBeenCalledTimes(2)
    expect(screen.queryByText('Khách đã nhận hàng')).toBeNull()
  })

  it('refreshes stale state when another staff member has already handed over the order', async () => {
    show()
    fireEvent.click(await screen.findByRole('button', { name: /Bàn giao tại quầy/ }))
    vi.mocked(orderApi.detail).mockResolvedValue({ ...counter, status: 'DELIVERED' })
    vi.mocked(dispatchApi.create).mockRejectedValue(new ApiError(409, 'Đơn đã xuất kho'))
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận bàn giao' }))
    expect(await screen.findByText('Đơn đã xuất kho')).toBeTruthy()
    expect(await screen.findByText('Khách đã nhận hàng')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Bàn giao tại quầy/ })).toBeNull()
  })

  it.each(['PENDING', 'CONFIRMED', 'DELIVERED', 'CANCELLED'] as const)('does not offer handover for %s', async status => {
    show({ ...counter, status })
    await screen.findByText('Đơn ORDER-12')
    expect(screen.queryByRole('button', { name: /Bàn giao tại quầy/ })).toBeNull()
  })

  it('keeps delivery orders on the trip workflow', async () => {
    show(order)
    expect((await screen.findByRole('link', { name: 'Xếp chuyến' })).getAttribute('href')).toBe('/delivery')
    expect(screen.queryByRole('button', { name: /Bàn giao tại quầy/ })).toBeNull()
  })

  it.each(['CUSTOMER', 'DELIVERY_STAFF'])('does not offer handover to %s', role => {
    show(counter, role)
    expect(screen.queryByRole('button', { name: /Bàn giao tại quầy/ })).toBeNull()
    expect(orderApi.detail).not.toHaveBeenCalled()
    expect(dispatchApi.create).not.toHaveBeenCalled()
  })
})
afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('FE1 customer screens and role separation', () => {
  it('redirects customers away from staff routes before rendering staff content', async () => {
    render(
      <Providers path="/orders">
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="/orders" element={<div>Staff controls</div>} />
          </Route>
          <Route path="/shop/orders" element={<div>Own orders</div>} />
        </Routes>
      </Providers>,
    )
    expect(await screen.findByText('Own orders')).toBeTruthy()
    expect(screen.queryByText('Staff controls')).toBeNull()
  })
  it('requires authentication for customer order pages', async () => {
    render(
      <Providers user={null}>
        <Routes>
          <Route element={<RequireCustomer />}>
            <Route path="/shop/orders" element={<CustomerOrdersPage />} />
          </Route>
          <Route path="/login" element={<div>Sign in first</div>} />
        </Routes>
      </Providers>,
    )
    expect(await screen.findByText('Sign in first')).toBeTruthy()
    expect(customerOrderApi.list).not.toHaveBeenCalled()
  })
  it('shows empty and populated lists without dispatch or trip controls', async () => {
    vi.mocked(customerOrderApi.list).mockResolvedValueOnce([]).mockResolvedValueOnce([order])
    render(
      <Providers>
        <CustomerOrdersPage />
      </Providers>,
    )
    expect(await screen.findByText('Bạn chưa có đơn hàng nào.')).toBeTruthy()
    const refresh = screen.getByRole('button', { name: /Làm mới/ })
    await waitFor(() => expect(refresh.className).not.toContain('ant-btn-loading'))
    fireEvent.click(refresh)
    expect(await screen.findByText('ORDER-12')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Xem chi tiết' }).getAttribute('href')).toBe('/shop/orders/12')
    expect(screen.queryByText('Xuất kho')).toBeNull()
    expect(orderDeliveryHistory).not.toHaveBeenCalled()
  })
  it('renders detail not-found for another customer’s order', async () => {
    vi.mocked(customerOrderApi.detail).mockRejectedValue(new ApiError(404, 'Not found'))
    render(
      <Providers path="/shop/orders/99">
        <Routes>
          <Route path="/shop/orders/:id" element={<CustomerOrderPage />} />
        </Routes>
      </Providers>,
    )
    expect(await screen.findByText('Đơn không tồn tại hoặc không thuộc tài khoản của bạn.')).toBeTruthy()
    expect(orderDeliveryHistory).not.toHaveBeenCalled()
  })
  it('renders PREPARING/OUT_FOR_DELIVERY/DELIVERED from the real order and stays read-only', async () => {
    vi.mocked(customerOrderApi.detail).mockResolvedValue(order)
    render(
      <Providers path="/shop/orders/12">
        <Routes>
          <Route path="/shop/orders/:id" element={<CustomerOrderPage />} />
        </Routes>
      </Providers>,
    )
    expect(await screen.findByText('Đơn ORDER-12')).toBeTruthy()
    expect(screen.getAllByText('Đang chuẩn bị').length).toBeGreaterThan(0)
    expect(screen.getByText('Đang giao')).toBeTruthy()
    expect(screen.getByText('Đã giao')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Xuất kho|Xác nhận đơn|Hủy đơn/ })).toBeNull()
    expect(orderDeliveryHistory).not.toHaveBeenCalled()
  })
  it('preserves an error state and supports retry', async () => {
    vi.mocked(customerOrderApi.list).mockRejectedValueOnce(new ApiError(500, 'Test server unavailable')).mockResolvedValueOnce([order])
    render(
      <Providers>
        <CustomerOrdersPage />
      </Providers>,
    )
    expect(await screen.findByText('Test server unavailable')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Làm mới/ }))
    expect(await screen.findByText('ORDER-12')).toBeTruthy()
  })
})

describe('FE1 delivery history', () => {
  it('never fetches staff delivery resources for a customer', () => {
    render(
      <Providers>
        <OrderDeliveryHistory orderId={12} />
      </Providers>,
    )
    expect(orderDeliveryHistory).not.toHaveBeenCalled()
    expect(screen.queryByText('Tiến trình giao hàng')).toBeNull()
  })
  it('shows failure reasons, subsequent success and a link to the related trip', async () => {
    vi.mocked(orderDeliveryHistory).mockResolvedValue([
      {
        trip: {
          id: 4,
          driverName: 'Driver A',
          vehicle: 'Truck',
          status: 'IN_PROGRESS',
          createdAt: '2026-11-05T01:00:00Z',
          startedAt: null,
          endedAt: null,
        },
        assignment: { id: 3, latestAttempt: { outcome: 'SUCCESS' } },
        attempts: [
          {
            id: 1,
            attemptNo: 1,
            outcome: 'FAILED',
            failureReason: 'Khách vắng nhà',
            recipientName: null,
            note: null,
            attemptedAt: '2026-11-05T02:00:00Z',
          },
          {
            id: 2,
            attemptNo: 2,
            outcome: 'SUCCESS',
            recipientName: 'Người nhận A',
            failureReason: null,
            note: null,
            attemptedAt: '2026-11-05T03:00:00Z',
          },
        ],
      },
    ] as Awaited<ReturnType<typeof orderDeliveryHistory>>)
    render(
      <Providers user={{ name: 'Sales', email: 'sales@test.com', role: 'SALES_STAFF' }}>
        <OrderDeliveryHistory orderId={12} />
      </Providers>,
    )
    expect(await screen.findByText('Lý do: Khách vắng nhà')).toBeTruthy()
    expect(screen.getByText('Lần 2 · Giao thành công')).toBeTruthy()
    expect(screen.getByText('Driver A')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Xem chuyến' }).getAttribute('href')).toBe('/delivery?tripId=4')
  })
})

describe('FE1 authentication', () => {
  it('accepts CUSTOMER login without classifying the user as sales staff', async () => {
    const response = {
      accessToken: 'test-token',
      tokenType: 'Bearer',
      expiresIn: 3600,
      user: { id: 7, fullName: 'Customer A', email: 'customer@test.com', phone: null, role: 'CUSTOMER', status: 'ACTIVE' },
    }
    vi.mocked(authService.login).mockResolvedValue(response)
    vi.mocked(authService.me).mockResolvedValue(response.user)
    function Probe() {
      const auth = useAuth()
      const staff = useStaff()
      return (
        <>
          <button onClick={() => void auth.login({ email: 'customer@test.com', password: 'test-password' })}>Login customer</button>
          <div>{auth.isAuthenticated ? 'Signed in' : 'Anonymous'}</div>
          <div>{staff ? 'Staff role' : 'No staff role'}</div>
        </>
      )
    }
    const client = new QueryClient()
    clients.push(client)
    render(
      <QueryClientProvider client={client}>
        <AntApp>
          <AuthProvider>
            <Probe />
          </AuthProvider>
        </AntApp>
      </QueryClientProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Login customer' }))
    await waitFor(() => expect(screen.getByText('Signed in')).toBeTruthy())
    expect(screen.getByText('No staff role')).toBeTruthy()
  })
})
