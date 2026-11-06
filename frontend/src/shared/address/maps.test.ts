import { describe, expect, it } from 'vitest'
import { mapsRouteUrl, mapsSearchUrl } from './maps'

describe('maps links', () => {
  it('adds the city only when the address lacks it', () => {
    expect(decodeURIComponent(mapsSearchUrl('12 Lê Lợi, Quận 1'))).toContain('12 Lê Lợi, Quận 1, TP. Hồ Chí Minh')
    expect(decodeURIComponent(mapsSearchUrl('12 Lê Lợi, Phường Bến Thành, TP. Hồ Chí Minh'))).not.toContain('Minh, TP.')
  })

  it('routes through stops in order and ends at the last one', () => {
    const route = mapsRouteUrl(['A, TP. Hồ Chí Minh', ' ', 'B, TP. Hồ Chí Minh', 'C, TP. Hồ Chí Minh'])!
    const params = new URL(route.url).searchParams
    expect(params.get('destination')).toBe('C, TP. Hồ Chí Minh')
    expect(params.get('waypoints')).toBe('A, TP. Hồ Chí Minh|B, TP. Hồ Chí Minh')
    expect(route.truncated).toBe(false)
  })

  it('caps the route at 10 stops and reports it', () => {
    const route = mapsRouteUrl(Array.from({ length: 12 }, (_, i) => `${i} Hồ Chí Minh`))!
    expect(new URL(route.url).searchParams.get('waypoints')!.split('|')).toHaveLength(9)
    expect(route.truncated).toBe(true)
    expect(mapsRouteUrl(['', ' '])).toBeNull()
  })
})
