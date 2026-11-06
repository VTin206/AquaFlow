// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { CustomerDebt } from './CustomerDebt'

afterEach(cleanup)

test('còn nợ hiện số tiền, trả hết thì ghi đã thu đủ, chưa mua thì ghi chưa có đơn; không dùng dấu gạch', () => {
  const { container, rerender } = render(<CustomerDebt debt={150000} orders={3} />)
  expect(container.textContent).toMatch(/150\.000/)
  rerender(<CustomerDebt debt={0} orders={3} />)
  expect(screen.getByText('Đã thu đủ')).toBeTruthy()
  rerender(<CustomerDebt debt={0} orders={0} />)
  expect(screen.getByText('Chưa có đơn')).toBeTruthy()
  expect(container.textContent).not.toContain('—')
})
