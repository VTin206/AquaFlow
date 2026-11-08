import { Button, Tooltip } from 'antd'
import { Route } from 'lucide-react'
import { MAX_ROUTE_STOPS, mapsRouteUrl } from '@/shared/address/maps'

/** Mở Google Maps với mọi điểm giao theo đúng thứ tự trong chuyến, xuất phát từ vị trí hiện tại. */
export function TripRouteButton({ addresses }: { addresses: (string | null | undefined)[] }) {
  const route = mapsRouteUrl(addresses.filter((address): address is string => Boolean(address)))
  if (!route) return null
  return (
    <Tooltip title={route.truncated ? `Google Maps chỉ nhận ${MAX_ROUTE_STOPS} điểm đầu của chuyến.` : 'Mở Google Maps ở thẻ mới'}>
      <Button size="small" className="af-trip-route" icon={<Route size={15} />} href={route.url} target="_blank" rel="noreferrer">
        Xem lộ trình cả chuyến
      </Button>
    </Tooltip>
  )
}
