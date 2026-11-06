import { HCM_CITY } from './hcmWards'

/** Số điểm Google Maps nhận trong một lộ trình qua đường dẫn (1 điểm đến + 9 điểm dừng). */
export const MAX_ROUTE_STOPS = 10

/** Địa chỉ cũ chưa ghi thành phố thì thêm TP. Hồ Chí Minh để Google tìm đúng nơi. */
const withCity = (address: string) => (/hồ chí minh|hcm/i.test(address) ? address : `${address}, ${HCM_CITY}`)

/** Mở Google Maps tại một địa chỉ; không cần khóa API. */
export const mapsSearchUrl = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(withCity(address.trim()))}`

/**
 * Lộ trình đi lần lượt các địa chỉ, xuất phát từ vị trí hiện tại của máy.
 * Google chỉ nhận tối đa 10 điểm nên phần dư bị bỏ; `truncated` cho biết để báo người dùng.
 */
export function mapsRouteUrl(addresses: string[]) {
  const stops = addresses.map((address) => address.trim()).filter(Boolean).map(withCity)
  if (!stops.length) return null
  const used = stops.slice(0, MAX_ROUTE_STOPS)
  const destination = used.at(-1)!
  const waypoints = used.slice(0, -1)
  const params = new URLSearchParams({ api: '1', destination, travelmode: 'driving' })
  if (waypoints.length) params.set('waypoints', waypoints.join('|'))
  return { url: `https://www.google.com/maps/dir/?${params}`, truncated: stops.length > MAX_ROUTE_STOPS }
}
