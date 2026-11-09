import { Button, Tooltip } from 'antd'
import type { ButtonProps } from 'antd'
import { Route } from 'lucide-react'
import { MAX_ROUTE_STOPS, mapsRouteUrl } from '@/shared/address/maps'

type Props = {
  addresses: (string | null | undefined)[]
  size?: ButtonProps['size']
  block?: boolean
  label?: string
}

/** Mở Google Maps với mọi điểm giao theo đúng thứ tự trong chuyến, xuất phát từ vị trí hiện tại. */
export function TripRouteButton({ addresses, size = 'small', block = false, label = 'Xem lộ trình cả chuyến' }: Props) {
  const route = mapsRouteUrl(addresses.filter((address): address is string => Boolean(address)))
  if (!route) return null
  return (
    <Tooltip title={route.truncated ? `Google Maps chỉ nhận ${MAX_ROUTE_STOPS} điểm đầu của chuyến.` : 'Mở Google Maps ở thẻ mới'}>
      <Button
        size={size}
        block={block}
        className="af-trip-route"
        icon={<Route size={size === 'large' ? 18 : 15} />}
        href={route.url}
        target="_blank"
        rel="noreferrer"
      >
        {label}
      </Button>
    </Tooltip>
  )
}
