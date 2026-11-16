// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import type { Order } from '../types'
import { OrderParty } from './OrderSheet'

const staff = vi.hoisted(() => ({ role: 'SALES_STAFF' }))
vi.mock('@/features/auth/useStaff', () => ({ useStaff: () => ({ name: 'Trang', role: staff.role }) }))

const order = (customerId?: string) =>
  ({ customer: 'Duy Mạnh', phone: '0365034644', method: 'Tại quầy', address: '', area: '', customerId }) as unknown as Order
afterEach(cleanup)
const mount = (value: Order) =>
  render(
    <MemoryRouter>
      <OrderParty order={value} />
    </MemoryRouter>,
  )

test('tên khách mở hồ sơ khách khi đơn gắn hồ sơ', () => {
  mount(order('42'))
  expect(screen.getByRole('link', { name: 'Duy Mạnh' }).getAttribute('href')).toBe('/customers?customerId=42')
})

test('khách vãng lai và nhân viên giao hàng không có link', () => {
  mount(order())
  expect(screen.queryByRole('link', { name: 'Duy Mạnh' })).toBeNull()
  cleanup()
  staff.role = 'DELIVERY_STAFF'
  mount(order('42'))
  expect(screen.queryByRole('link', { name: 'Duy Mạnh' })).toBeNull()
})
