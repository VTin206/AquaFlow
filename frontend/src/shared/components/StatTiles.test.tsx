// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { StatChange, StatTile, StatTiles } from './StatTiles'

afterEach(cleanup)

test('shows the number with a small currency unit and keeps text values apart', () => {
  render(
    <StatTiles label="Hôm nay">
      <StatTile title="Doanh thu" money value={2_107_000} />
      <StatTile title="Lãi gộp" money value="Chưa đủ giá nhập" />
      <StatTile title="Đơn" value={undefined} />
    </StatTiles>,
  )
  const revenue = screen.getByText('Doanh thu').nextElementSibling
  expect(revenue?.textContent).toBe('2.107.000₫')
  expect(revenue?.querySelector('small')?.textContent).toBe('₫')
  expect(screen.getByText('Chưa đủ giá nhập').className).toContain('is-text')
  expect(screen.getByText('—')).toBeTruthy()
})

test('describes the change against the previous period in words, not only colour', () => {
  const { rerender } = render(<StatChange current={170} previous={30} />)
  expect(screen.getByText(/so với kỳ trước/).textContent).toBe('+467% so với kỳ trước')
  rerender(<StatChange current={80} previous={100} period="hôm qua" />)
  expect(screen.getByText(/so với hôm qua/).textContent).toBe('−20% so với hôm qua')
  rerender(<StatChange current={5} previous={0} period="hôm qua" />)
  expect(screen.getByText('Hôm qua chưa phát sinh')).toBeTruthy()
})
